package service

import (
	"encoding/json"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"fmt"
	"log"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

const bytesToGB = 1024 * 1024 * 1024

// Lock maps are keyed by entity IDs. Growth is bounded by the number of
// users/forwards/tunnels in the system (each sync.Mutex is ~8 bytes), so
// explicit cleanup is unnecessary for expected workloads.
var (
	userLocks    sync.Map
	tunnelLocks  sync.Map
	forwardLocks sync.Map
)

func getUserLock(id string) *sync.Mutex {
	v, _ := userLocks.LoadOrStore(id, &sync.Mutex{})
	return v.(*sync.Mutex)
}

func getTunnelLock(id string) *sync.Mutex {
	v, _ := tunnelLocks.LoadOrStore(id, &sync.Mutex{})
	return v.(*sync.Mutex)
}

func getForwardLock(id string) *sync.Mutex {
	v, _ := forwardLocks.LoadOrStore(id, &sync.Mutex{})
	return v.(*sync.Mutex)
}

func ProcessFlowUpload(rawData, secret string) string {
	// Validate node
	var nodeCount int64
	DB.Model(&model.Node{}).Where("secret = ?", secret).Count(&nodeCount)
	if nodeCount == 0 {
		log.Printf("[GOST流量] 无效的节点密钥: %s", secret)
		return "ok"
	}

	// Decrypt if needed
	decrypted := decryptIfNeeded(rawData, secret)

	var flowData dto.FlowDto
	if err := json.Unmarshal([]byte(decrypted), &flowData); err != nil {
		log.Printf("[GOST流量] JSON解析失败: %v, raw=%s", err, decrypted)
		return "ok"
	}

	if flowData.N == "web_api" {
		return "ok"
	}

	log.Printf("[GOST流量] 上报: %+v", flowData)
	return processFlowData(flowData)
}

func ProcessFlowConfig(rawData, secret string) string {
	var node model.Node
	if err := DB.Where("secret = ?", secret).First(&node).Error; err != nil {
		return "ok"
	}

	decrypted := decryptIfNeeded(rawData, secret)

	var gostConfig dto.GostConfigDto
	if err := json.Unmarshal([]byte(decrypted), &gostConfig); err != nil {
		log.Printf("解析节点配置失败: %v", err)
		return "ok"
	}

	go CleanNodeConfigs(fmt.Sprintf("%d", node.ID), gostConfig)
	return "ok"
}

func ProcessXrayFlowUpload(rawData, secret string) string {
	var nodeCount int64
	DB.Model(&model.Node{}).Where("secret = ?", secret).Count(&nodeCount)
	if nodeCount == 0 {
		log.Printf("[Xray流量] 无效的节点密钥: %s", secret)
		return "ok"
	}

	decrypted := decryptIfNeeded(rawData, secret)

	var data struct {
		Clients []struct {
			Email string `json:"email"`
			U     int64  `json:"u"`
			D     int64  `json:"d"`
		} `json:"clients"`
	}
	if err := json.Unmarshal([]byte(decrypted), &data); err != nil {
		log.Printf("[Xray流量] JSON解析失败: %v, raw=%s", err, decrypted)
		return "ok"
	}

	log.Printf("[Xray流量] 上报: %d 个客户端", len(data.Clients))

	for _, client := range data.Clients {
		if client.Email == "" || (client.U == 0 && client.D == 0) {
			continue
		}

		var xrayClient model.XrayClient
		if err := DB.Where("email = ?", client.Email).First(&xrayClient).Error; err != nil {
			log.Printf("[Xray流量] 客户端 %s 未找到: %v", client.Email, err)
			continue
		}

		// Atomic update xray_client traffic
		DB.Model(&model.XrayClient{}).Where("id = ?", xrayClient.ID).
			UpdateColumns(map[string]interface{}{
				"up_traffic":   gorm.Expr("up_traffic + ?", client.U),
				"down_traffic": gorm.Expr("down_traffic + ?", client.D),
			})

		// Update user flow
		lock := getUserLock(fmt.Sprintf("%d", xrayClient.UserId))
		lock.Lock()
		DB.Model(&model.User{}).Where("id = ?", xrayClient.UserId).
			UpdateColumns(map[string]interface{}{
				"in_flow":  gorm.Expr("in_flow + ?", client.D),
				"out_flow": gorm.Expr("out_flow + ?", client.U),
			})
		lock.Unlock()

		// Check traffic limit
		if xrayClient.TotalTraffic > 0 {
			var updated model.XrayClient
			DB.First(&updated, xrayClient.ID)
			if updated.UpTraffic+updated.DownTraffic >= xrayClient.TotalTraffic {
				DB.Model(&updated).Update("enable", 0)
				log.Printf("Xray 客户端 %s 流量超限，已禁用", client.Email)
			}
		}
	}

	return "ok"
}

func processFlowData(flowData dto.FlowDto) string {
	parts := strings.Split(flowData.N, "_")
	if len(parts) < 3 {
		return "ok"
	}
	forwardId := parts[0]
	userId := parts[1]
	userTunnelId := parts[2]

	// Get forward and tunnel for flow type and ratio
	var forward model.Forward
	if err := DB.First(&forward, forwardId).Error; err != nil {
		return "ok"
	}

	flowType := 2
	var trafficRatio float64 = 1.0
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, forward.TunnelId).Error; err == nil {
		if tunnel.Flow > 0 {
			flowType = tunnel.Flow
		}
		if tunnel.TrafficRatio > 0 {
			trafficRatio = tunnel.TrafficRatio
		}
	}

	// Apply traffic ratio and flow type
	d := int64(math.Floor(float64(flowData.D) * trafficRatio * float64(flowType)))
	u := int64(math.Floor(float64(flowData.U) * trafficRatio * float64(flowType)))

	log.Printf("[GOST流量] 处理: fwd=%s user=%s tunnel=%s flowType=%d ratio=%.2f raw(u=%d,d=%d) calc(u=%d,d=%d)",
		forwardId, userId, userTunnelId, flowType, trafficRatio, flowData.U, flowData.D, u, d)

	// Update forward flow
	fwdLock := getForwardLock(forwardId)
	fwdLock.Lock()
	DB.Model(&model.Forward{}).Where("id = ?", forwardId).
		UpdateColumns(map[string]interface{}{
			"in_flow":  gorm.Expr("in_flow + ?", d),
			"out_flow": gorm.Expr("out_flow + ?", u),
		})
	fwdLock.Unlock()

	// Update user flow
	uLock := getUserLock(userId)
	uLock.Lock()
	DB.Model(&model.User{}).Where("id = ?", userId).
		UpdateColumns(map[string]interface{}{
			"in_flow":  gorm.Expr("in_flow + ?", d),
			"out_flow": gorm.Expr("out_flow + ?", u),
		})
	uLock.Unlock()

	// Update user_tunnel flow
	if userTunnelId != "0" {
		tLock := getTunnelLock(userTunnelId)
		tLock.Lock()
		DB.Model(&model.UserTunnel{}).Where("id = ?", userTunnelId).
			UpdateColumns(map[string]interface{}{
				"in_flow":  gorm.Expr("in_flow + ?", d),
				"out_flow": gorm.Expr("out_flow + ?", u),
			})
		tLock.Unlock()
	}

	// Check limits (non-admin forwards only)
	serviceName := forwardId + "_" + userId + "_" + userTunnelId
	if userTunnelId != "0" {
		checkUserLimits(userId, serviceName)
		checkUserTunnelLimits(userTunnelId, serviceName, userId)
	}

	return "ok"
}

func checkUserLimits(userId, serviceName string) {
	var user model.User
	if err := DB.First(&user, userId).Error; err != nil {
		return
	}

	userFlowLimit := user.Flow * bytesToGB
	userCurrentFlow := user.InFlow + user.OutFlow
	if userFlowLimit < userCurrentFlow {
		pauseAllUserServices(userId, serviceName)
		return
	}

	if user.ExpTime > 0 && user.ExpTime <= time.Now().UnixMilli() {
		pauseAllUserServices(userId, serviceName)
		return
	}

	if user.Status != 1 {
		pauseAllUserServices(userId, serviceName)
	}
}

func checkUserTunnelLimits(userTunnelId, serviceName, userId string) {
	utId, _ := strconv.ParseInt(userTunnelId, 10, 64)
	var ut model.UserTunnel
	if err := DB.First(&ut, utId).Error; err != nil {
		return
	}

	flow := ut.InFlow + ut.OutFlow
	if flow >= ut.Flow*bytesToGB {
		pauseSpecificForward(ut.TunnelId, serviceName, userId)
		return
	}

	if ut.ExpTime > 0 && ut.ExpTime <= time.Now().UnixMilli() {
		pauseSpecificForward(ut.TunnelId, serviceName, userId)
		return
	}

	if ut.Status != 1 {
		pauseSpecificForward(ut.TunnelId, serviceName, userId)
	}
}

func pauseAllUserServices(userId, serviceName string) {
	var forwards []model.Forward
	DB.Where("user_id = ?", userId).Find(&forwards)
	pauseForwardServices(forwards, serviceName)
}

func pauseSpecificForward(tunnelId int64, serviceName, userId string) {
	var forwards []model.Forward
	DB.Where("tunnel_id = ? AND user_id = ?", tunnelId, userId).Find(&forwards)
	pauseForwardServices(forwards, serviceName)
}

func pauseForwardServices(forwards []model.Forward, serviceName string) {
	for _, fwd := range forwards {
		var tunnel model.Tunnel
		if err := DB.First(&tunnel, fwd.TunnelId).Error; err != nil {
			continue
		}
		pkg.PauseService(tunnel.InNodeId, serviceName)
		if tunnel.Type == 2 {
			pkg.PauseRemoteService(tunnel.OutNodeId, serviceName)
		}
		DB.Model(&fwd).Update("status", 0)
	}
}

func FlowDebug(secret string) map[string]interface{} {
	result := map[string]interface{}{}

	// 1. Check if secret matches a node
	var node model.Node
	if secret == "" {
		result["node"] = "未提供 secret 参数"
	} else if err := DB.Where("secret = ?", secret).First(&node).Error; err != nil {
		result["node"] = "secret 无效，未匹配到节点"
	} else {
		result["node"] = map[string]interface{}{
			"id":   node.ID,
			"name": node.Name,
		}
	}

	// 2. List some forwards with flow data
	var forwards []model.Forward
	DB.Order("in_flow + out_flow DESC").Limit(5).Find(&forwards)
	fwdList := []map[string]interface{}{}
	for _, f := range forwards {
		fwdList = append(fwdList, map[string]interface{}{
			"id": f.ID, "inFlow": f.InFlow, "outFlow": f.OutFlow,
		})
	}
	result["topForwards"] = fwdList

	// 3. List users with flow data
	var users []model.User
	DB.Select("id, user, in_flow, out_flow").Order("in_flow + out_flow DESC").Limit(5).Find(&users)
	userList := []map[string]interface{}{}
	for _, u := range users {
		userList = append(userList, map[string]interface{}{
			"id": u.ID, "user": u.User, "inFlow": u.InFlow, "outFlow": u.OutFlow,
		})
	}
	result["topUsers"] = userList

	// 4. List xray clients with traffic
	var xrayClients []model.XrayClient
	DB.Select("id, email, up_traffic, down_traffic").Order("up_traffic + down_traffic DESC").Limit(5).Find(&xrayClients)
	xcList := []map[string]interface{}{}
	for _, xc := range xrayClients {
		xcList = append(xcList, map[string]interface{}{
			"id": xc.ID, "email": xc.Email, "upTraffic": xc.UpTraffic, "downTraffic": xc.DownTraffic,
		})
	}
	result["topXrayClients"] = xcList

	// 5. Test gorm.Expr with a dry-run
	testSQL := DB.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return tx.Model(&model.User{}).Where("id = ?", 1).UpdateColumns(map[string]interface{}{
			"in_flow": gorm.Expr("in_flow + ?", 100),
		})
	})
	result["gormExprTestSQL"] = testSQL

	return result
}

func decryptIfNeeded(rawData, secret string) string {
	if rawData == "" {
		return rawData
	}

	var enc pkg.EncryptedMessage
	if err := json.Unmarshal([]byte(rawData), &enc); err != nil {
		return rawData
	}

	if !enc.Encrypted || enc.Data == "" {
		return rawData
	}

	crypto := pkg.GetOrCreateCrypto(secret)
	if crypto == nil {
		return rawData
	}

	decrypted, err := crypto.Decrypt(enc.Data)
	if err != nil {
		log.Printf("数据解密失败: %v", err)
		return rawData
	}
	return decrypted
}
