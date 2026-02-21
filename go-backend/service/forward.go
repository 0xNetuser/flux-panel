package service

import (
	"encoding/json"
	"fmt"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"net"
	"strings"
	"time"
)

// Constants
const (
	gostSuccessMsg          = "OK"
	gostNotFoundMsg         = "not found"
	adminRoleId             = 0
	tunnelTypePortForward   = 1
	tunnelTypeTunnelForward = 2
	forwardStatusActive     = 1
	forwardStatusPaused     = 0
	forwardStatusError      = -1
	tunnelStatusActive      = 1
)

// ForwardWithTunnel is a result struct for JOIN queries
type ForwardWithTunnel struct {
	model.Forward
	TunnelName string `json:"tunnelName" gorm:"column:tunnel_name"`
	TunnelType int    `json:"tunnelType" gorm:"column:tunnel_type"`
	InIp       string `json:"inIp" gorm:"column:in_ip"`
	OutIp      string `json:"outIp" gorm:"column:out_ip"`
}

// DiagnosisResult holds a single TCP ping diagnosis result
type DiagnosisResult struct {
	NodeId      int64   `json:"nodeId"`
	NodeName    string  `json:"nodeName"`
	TargetIp    string  `json:"targetIp"`
	TargetPort  int     `json:"targetPort"`
	Description string  `json:"description"`
	Success     bool    `json:"success"`
	Message     string  `json:"message"`
	AverageTime float64 `json:"averageTime"`
	PacketLoss  float64 `json:"packetLoss"`
	Timestamp   int64   `json:"timestamp"`
}

// ---------------------- Public API functions ----------------------

func CreateForward(d dto.ForwardDto, userId int64, roleId int, userName string) dto.R {
	// 0. SSRF check
	if ssrfErr := validateRemoteAddr(d.RemoteAddr, roleId); ssrfErr != "" {
		return dto.Err(ssrfErr)
	}

	// 0.5 GOST permission check for non-admin users
	if roleId != adminRoleId {
		var user model.User
		if err := DB.First(&user, userId).Error; err != nil {
			return dto.Err("用户不存在")
		}
		if user.GostEnabled != 1 {
			return dto.Err("你没有 GOST 转发权限")
		}
	}

	// 1. Get tunnel, check status
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, d.TunnelId).Error; err != nil {
		return dto.Err("隧道不存在")
	}
	if tunnel.Status != tunnelStatusActive {
		return dto.Err("隧道已禁用，无法创建转发")
	}

	// 1.5 Node access check for non-admin users
	if roleId != adminRoleId {
		inNode := GetNodeById(tunnel.InNodeId)
		if inNode != nil && !UserHasNodeAccess(userId, inNode.ID) {
			return dto.Err("你没有该入口节点的访问权限")
		}
		if tunnel.Type == tunnelTypeTunnelForward {
			outNode := GetNodeById(tunnel.OutNodeId)
			if outNode != nil && !UserHasNodeAccess(userId, outNode.ID) {
				return dto.Err("你没有该出口节点的访问权限")
			}
		}
	}

	// 2. Permission check for non-admin users
	var limiter *int64
	var userTunnel *model.UserTunnel
	if roleId != adminRoleId {
		var errMsg string
		limiter, userTunnel, errMsg = checkUserPermissions(userId, roleId, &tunnel, nil)
		if errMsg != "" {
			return dto.Err(errMsg)
		}
	}

	// 3. Allocate ports
	inPort, outPort, portErr := allocatePorts(&tunnel, d.InPort, nil)
	if portErr != "" {
		return dto.Err(portErr)
	}

	// 4. Create forward entity and save
	now := time.Now().UnixMilli()
	forward := model.Forward{
		UserId:        userId,
		UserName:      userName,
		Name:          d.Name,
		TunnelId:      d.TunnelId,
		RemoteAddr:    d.RemoteAddr,
		Strategy:      d.Strategy,
		ListenIp:      d.ListenIp,
		InterfaceName: d.InterfaceName,
		InPort:        inPort,
		OutPort:       outPort,
		Status:        forwardStatusActive,
		CreatedTime:   now,
		UpdatedTime:   now,
	}
	if err := DB.Create(&forward).Error; err != nil {
		return dto.Err("端口转发创建失败")
	}

	// 5. Get required nodes
	inNode, outNode, nodeErr := getRequiredNodes(&tunnel)
	if nodeErr != "" {
		DB.Delete(&forward)
		return dto.Err(nodeErr)
	}

	// 6. Override tunnel listen address if forward has custom listenIp
	if forward.ListenIp != "" {
		tunnel.TcpListenAddr = forward.ListenIp
		tunnel.UdpListenAddr = forward.ListenIp
	}

	// 7. Create GOST services
	serviceName := buildServiceName(forward.ID, forward.UserId, userTunnel)
	gostErr := createGostServices(&forward, &tunnel, limiter, inNode, outNode, serviceName)
	if gostErr != "" {
		DB.Delete(&forward)
		return dto.Err(gostErr)
	}

	return dto.OkMsg()
}

func GetAllForwards(userId int64, roleId int) dto.R {
	var forwards []ForwardWithTunnel

	query := `SELECT f.*, t.name as tunnel_name, COALESCE(NULLIF(f.listen_ip,''), t.in_ip) as in_ip, t.type as tunnel_type, t.out_ip
		FROM forward f LEFT JOIN tunnel t ON f.tunnel_id = t.id`

	if roleId != adminRoleId {
		query += ` WHERE f.user_id = ?`
		query += ` ORDER BY f.inx ASC, f.created_time DESC`
		DB.Raw(query, userId).Scan(&forwards)
	} else {
		query += ` ORDER BY f.inx ASC, f.created_time DESC`
		DB.Raw(query).Scan(&forwards)
	}

	return dto.Ok(forwards)
}

func UpdateForward(d dto.ForwardUpdateDto, userId int64, roleId int) dto.R {
	// 0. Non-admin: always use authenticated userId (ignore client-supplied value)
	if roleId != adminRoleId {
		d.UserId = userId
	}

	// 1. Non-admin user status check
	if roleId != adminRoleId {
		var user model.User
		if err := DB.First(&user, userId).Error; err != nil {
			return dto.Err("用户不存在")
		}
		if user.Status == 0 {
			return dto.Err("用户已到期或被禁用")
		}
	}

	// 1.5 SSRF check
	if ssrfErr := validateRemoteAddr(d.RemoteAddr, roleId); ssrfErr != "" {
		return dto.Err(ssrfErr)
	}

	// 2. Validate forward exists and user has access
	existForward := validateForwardExists(d.ID, userId, roleId)
	if existForward == nil {
		return dto.Err("转发不存在")
	}

	// 3. Validate tunnel
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, d.TunnelId).Error; err != nil {
		return dto.Err("隧道不存在")
	}
	if tunnel.Status != tunnelStatusActive {
		return dto.Err("隧道已禁用，无法更新转发")
	}

	tunnelChanged := existForward.TunnelId != d.TunnelId

	// 4. Permission checks
	var limiter *int64
	var permUserTunnel *model.UserTunnel
	if tunnelChanged {
		if roleId == adminRoleId {
			if userId == existForward.UserId {
				// Admin operating on own forward - no permission check needed
			} else {
				// Admin operating on user's forward - check original user permissions
				var originalUser model.User
				if err := DB.First(&originalUser, existForward.UserId).Error; err != nil {
					return dto.Err("用户不存在")
				}
				ut := getUserTunnel(existForward.UserId, d.TunnelId)
				if ut == nil {
					return dto.Err("用户没有该隧道权限")
				}
				if ut.Status != 1 {
					return dto.Err("隧道被禁用")
				}
				if ut.ExpTime != 0 && ut.ExpTime <= time.Now().UnixMilli() {
					return dto.Err("用户的该隧道权限已到期")
				}
				quotaErr := checkForwardQuota(existForward.UserId, d.TunnelId, ut, &originalUser, &d.ID)
				if quotaErr != "" {
					return dto.Err("用户" + quotaErr)
				}
				limiter = ut.SpeedId
				permUserTunnel = ut
			}
		} else {
			var errMsg string
			limiter, permUserTunnel, errMsg = checkUserPermissions(userId, roleId, &tunnel, &d.ID)
			if errMsg != "" {
				return dto.Err(errMsg)
			}
		}
	}

	// 5. Get UserTunnel for service name building
	var userTunnel *model.UserTunnel
	if roleId != adminRoleId {
		userTunnel = getUserTunnel(userId, tunnel.ID)
		if userTunnel == nil {
			return dto.Err("你没有该隧道权限")
		}
	} else {
		// Admin: look up the forward owner's UserTunnel for correct service name.
		// nil is expected when admin owns the forward (admins don't have UserTunnel records),
		// which produces userTunnelId=0, matching the service name from creation.
		userTunnel = getUserTunnel(existForward.UserId, tunnel.ID)
	}

	// Use permission result userTunnel if available and tunnel changed
	if tunnelChanged && permUserTunnel != nil {
		userTunnel = permUserTunnel
	}

	// 6. Update forward entity - handle port allocation
	// Always use the DB owner userId (not client-supplied d.UserId which may be 0 for admin)
	updatedForward := model.Forward{
		ID:            d.ID,
		UserId:        existForward.UserId,
		Name:          d.Name,
		TunnelId:      d.TunnelId,
		RemoteAddr:    d.RemoteAddr,
		Strategy:      d.Strategy,
		ListenIp:      d.ListenIp,
		InterfaceName: d.InterfaceName,
		UpdatedTime:   time.Now().UnixMilli(),
	}

	inPortChanged := d.InPort != nil && *d.InPort != existForward.InPort
	if tunnelChanged || inPortChanged {
		specifiedInPort := d.InPort
		if specifiedInPort == nil && !tunnelChanged {
			specifiedInPort = &existForward.InPort
		}
		allocInPort, allocOutPort, portErr := allocatePorts(&tunnel, specifiedInPort, &d.ID)
		if portErr != "" {
			return dto.Err(portErr)
		}
		updatedForward.InPort = allocInPort
		updatedForward.OutPort = allocOutPort
	} else {
		updatedForward.InPort = existForward.InPort
		updatedForward.OutPort = existForward.OutPort
	}

	// 7. Get required nodes
	inNode, outNode, nodeErr := getRequiredNodes(&tunnel)
	if nodeErr != "" {
		return dto.Err(nodeErr)
	}

	// 7.5 Override tunnel listen address if forward has custom listenIp
	if updatedForward.ListenIp != "" {
		tunnel.TcpListenAddr = updatedForward.ListenIp
		tunnel.UdpListenAddr = updatedForward.ListenIp
	}

	// 8. Update GOST services
	serviceName := buildServiceName(updatedForward.ID, updatedForward.UserId, userTunnel)
	var limiterInt *int
	if limiter != nil {
		v := int(*limiter)
		limiterInt = &v
	}

	listenIpChanged := existForward.ListenIp != updatedForward.ListenIp

	if tunnelChanged || listenIpChanged {
		// Tunnel or listenIp changed: delete old config, create new
		var oldTunnel model.Tunnel
		if tunnelChanged {
			if err := DB.First(&oldTunnel, existForward.TunnelId).Error; err != nil {
				return dto.Err("原隧道不存在，无法删除旧配置")
			}
		} else {
			oldTunnel = tunnel
		}
		deleteOldGostServices(existForward, &oldTunnel)

		gostErr := createGostServices(&updatedForward, &tunnel, limiter, inNode, outNode, serviceName)
		if gostErr != "" {
			// Save new tunnel/port data to DB so reconcile can recreate on the correct tunnel
			// (old services are already deleted, so DB must reflect the new target)
			DB.Model(&model.Forward{}).Where("id = ?", updatedForward.ID).Updates(map[string]interface{}{
				"tunnel_id": updatedForward.TunnelId,
				"in_port":   updatedForward.InPort,
				"out_port":  updatedForward.OutPort,
				"listen_ip": updatedForward.ListenIp,
				"status":    forwardStatusError,
			})
			return dto.Err("创建新配置失败: " + gostErr)
		}
	} else {
		// Tunnel unchanged: figure out what changed and pick the lightest update path
		portSame := existForward.InPort == updatedForward.InPort
		interfaceSame := existForward.InterfaceName == updatedForward.InterfaceName
		addrChanged := existForward.RemoteAddr != updatedForward.RemoteAddr || existForward.Strategy != updatedForward.Strategy

		if portSame && interfaceSame && addrChanged {
			// Only remoteAddr/strategy changed — hot update forwarder (no listener restart)
			var hotOk bool
			if tunnel.Type == tunnelTypePortForward {
				// Direct forward: update forwarder on inNode
				hotResult := pkg.UpdateForwarder(inNode.ID, serviceName, updatedForward.RemoteAddr, updatedForward.Strategy)
				hotOk = isGostSuccess(hotResult)
			} else if tunnel.Type == tunnelTypeTunnelForward && outNode != nil {
				// Tunnel forward: only the outNode remote service forwarder changes;
				// inNode service + chain are unchanged (chain points to outNode, not to targets)
				hotResult := pkg.UpdateRemoteForwarder(outNode.ID, serviceName, updatedForward.RemoteAddr, updatedForward.Strategy)
				hotOk = isGostSuccess(hotResult)
			}

			if !hotOk {
				// Fall back to full update
				gostErr := updateGostServices(&updatedForward, &tunnel, limiterInt, inNode, outNode, serviceName)
				if gostErr != "" {
					updateForwardStatusToError(updatedForward.ID)
					return dto.Err(gostErr)
				}
			}
		} else if portSame && interfaceSame && !addrChanged {
			// Nothing service-critical changed (e.g. only name updated).
			// Limiter changes are handled separately via UpdateUserTunnel.
		} else {
			// Port or interface changed — must rebuild listener (same service name,
			// so we cannot create-then-delete; must use UpdateService which does
			// close → recreate). Only THIS forward's listener is affected.
			gostErr := updateGostServices(&updatedForward, &tunnel, limiterInt, inNode, outNode, serviceName)
			if gostErr != "" {
				updateForwardStatusToError(updatedForward.ID)
				return dto.Err(gostErr)
			}
		}
	}

	updatedForward.Status = forwardStatusActive
	if err := DB.Model(&model.Forward{}).Where("id = ?", updatedForward.ID).Updates(map[string]interface{}{
		"name":           updatedForward.Name,
		"tunnel_id":      updatedForward.TunnelId,
		"remote_addr":    updatedForward.RemoteAddr,
		"strategy":       updatedForward.Strategy,
		"listen_ip":      updatedForward.ListenIp,
		"interface_name": updatedForward.InterfaceName,
		"in_port":        updatedForward.InPort,
		"out_port":       updatedForward.OutPort,
		"status":         updatedForward.Status,
		"updated_time":   updatedForward.UpdatedTime,
	}).Error; err != nil {
		return dto.Err("端口转发更新失败")
	}

	return dto.Ok("端口转发更新成功")
}

func DeleteForward(id int64, userId int64, roleId int) dto.R {
	// 1. Validate forward exists
	forward := validateForwardExists(id, userId, roleId)
	if forward == nil {
		return dto.Err("端口转发不存在")
	}

	// 2. Get tunnel
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, forward.TunnelId).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	// 3. Get UserTunnel for service name
	var userTunnel *model.UserTunnel
	if roleId != adminRoleId {
		userTunnel = getUserTunnel(userId, tunnel.ID)
		if userTunnel == nil {
			return dto.Err("你没有该隧道权限")
		}
	} else {
		userTunnel = getUserTunnel(forward.UserId, tunnel.ID)
	}

	// 4. Get required nodes
	inNode, outNode, nodeErr := getRequiredNodes(&tunnel)
	if nodeErr != "" {
		return dto.Err(nodeErr)
	}

	// 5. Delete GOST services
	serviceName := buildServiceName(forward.ID, forward.UserId, userTunnel)
	gostErr := deleteGostServicesWithIP(&tunnel, inNode, outNode, serviceName, forward.ListenIp)
	if gostErr != "" {
		return dto.Err(gostErr)
	}

	// 6. Delete forward record
	if err := DB.Delete(&model.Forward{}, id).Error; err != nil {
		return dto.Err("端口转发删除失败")
	}
	return dto.Ok("端口转发删除成功")
}

func PauseForward(id int64, userId int64, roleId int) dto.R {
	// 1. Non-admin user status check
	if roleId != adminRoleId {
		var user model.User
		if err := DB.First(&user, userId).Error; err != nil {
			return dto.Err("用户不存在")
		}
		if user.Status == 0 {
			return dto.Err("用户已到期或被禁用")
		}
	}

	// 2. Validate forward
	forward := validateForwardExists(id, userId, roleId)
	if forward == nil {
		return dto.Err("转发不存在")
	}

	// 3. Get tunnel
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, forward.TunnelId).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	// 4. Get UserTunnel for service name
	var userTunnel *model.UserTunnel
	if roleId != adminRoleId {
		userTunnel = getUserTunnel(userId, tunnel.ID)
		if userTunnel == nil {
			return dto.Err("你没有该隧道权限")
		}
	}
	if userTunnel == nil {
		userTunnel = getUserTunnel(forward.UserId, tunnel.ID)
	}

	// 5. Get required nodes
	inNode, outNode, nodeErr := getRequiredNodes(&tunnel)
	if nodeErr != "" {
		return dto.Err(nodeErr)
	}

	// 6. Pause GOST services
	serviceName := buildServiceName(forward.ID, forward.UserId, userTunnel)
	var result *dto.GostResponse
	if forward.ListenIp != "" && strings.Contains(forward.ListenIp, ",") {
		result = pkg.PauseServiceMultiIP(inNode.ID, serviceName, forward.ListenIp)
	} else {
		result = pkg.PauseService(inNode.ID, serviceName)
	}
	if !isGostSuccess(result) {
		return dto.Err("暂停服务失败：" + result.Msg)
	}

	if tunnel.Type == tunnelTypeTunnelForward && outNode != nil {
		remoteResult := pkg.PauseRemoteService(outNode.ID, serviceName)
		if !isGostSuccess(remoteResult) {
			return dto.Err("暂停远端服务失败：" + remoteResult.Msg)
		}
	}

	// 7. Update status
	DB.Model(&model.Forward{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       forwardStatusPaused,
		"updated_time": time.Now().UnixMilli(),
	})

	return dto.Ok("服务已暂停")
}

func ResumeForward(id int64, userId int64, roleId int) dto.R {
	// 1. Non-admin user status check
	if roleId != adminRoleId {
		var user model.User
		if err := DB.First(&user, userId).Error; err != nil {
			return dto.Err("用户不存在")
		}
		if user.Status == 0 {
			return dto.Err("用户已到期或被禁用")
		}
	}

	// 2. Validate forward
	forward := validateForwardExists(id, userId, roleId)
	if forward == nil {
		return dto.Err("转发不存在")
	}

	// 3. Get tunnel
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, forward.TunnelId).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	if tunnel.Status != tunnelStatusActive {
		return dto.Err("隧道已禁用，无法恢复服务")
	}

	// 4. Flow limit checks for non-admin
	var userTunnel *model.UserTunnel
	if roleId != adminRoleId {
		flowErr := checkUserFlowLimits(userId, &tunnel)
		if flowErr != "" {
			return dto.Err(flowErr)
		}
		userTunnel = getUserTunnel(userId, tunnel.ID)
		if userTunnel == nil {
			return dto.Err("你没有该隧道权限")
		}
		if userTunnel.Status != 1 {
			return dto.Err("隧道被禁用")
		}
	}

	if userTunnel == nil {
		userTunnel = getUserTunnel(forward.UserId, tunnel.ID)
	}

	// 5. Get required nodes
	inNode, outNode, nodeErr := getRequiredNodes(&tunnel)
	if nodeErr != "" {
		return dto.Err(nodeErr)
	}

	// 6. Resume GOST services
	serviceName := buildServiceName(forward.ID, forward.UserId, userTunnel)
	var result *dto.GostResponse
	if forward.ListenIp != "" && strings.Contains(forward.ListenIp, ",") {
		result = pkg.ResumeServiceMultiIP(inNode.ID, serviceName, forward.ListenIp)
	} else {
		result = pkg.ResumeService(inNode.ID, serviceName)
	}
	if !isGostSuccess(result) {
		return dto.Err("恢复服务失败：" + result.Msg)
	}

	if tunnel.Type == tunnelTypeTunnelForward && outNode != nil {
		remoteResult := pkg.ResumeRemoteService(outNode.ID, serviceName)
		if !isGostSuccess(remoteResult) {
			return dto.Err("恢复远端服务失败：" + remoteResult.Msg)
		}
	}

	// 7. Update status
	DB.Model(&model.Forward{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       forwardStatusActive,
		"updated_time": time.Now().UnixMilli(),
	})

	return dto.Ok("服务已恢复")
}

func ForceDeleteForward(id int64) dto.R {
	var forward model.Forward
	if err := DB.First(&forward, id).Error; err != nil {
		return dto.Err("端口转发不存在")
	}

	if err := DB.Delete(&model.Forward{}, id).Error; err != nil {
		return dto.Err("端口转发强制删除失败")
	}
	return dto.Ok("端口转发强制删除成功")
}

func DiagnoseForward(id int64, userId int64, roleId int) dto.R {
	// 1. Validate forward
	forward := validateForwardExists(id, userId, roleId)
	if forward == nil {
		return dto.Err("转发不存在")
	}

	// 2. Get tunnel
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, forward.TunnelId).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	// 3. Get in node
	inNode := GetNodeById(tunnel.InNodeId)
	if inNode == nil {
		return dto.Err("入口节点不存在")
	}

	var results []DiagnosisResult
	remoteAddresses := strings.Split(forward.RemoteAddr, ",")

	if tunnel.Type == tunnelTypePortForward {
		// Port forward: TCP ping from inNode to remote targets
		for _, addr := range remoteAddresses {
			targetIp := extractIpFromAddress(addr)
			targetPort := extractPortFromAddress(addr)
			if targetIp == "" || targetPort == -1 {
				return dto.Err("无法解析目标地址: " + addr)
			}
			result := performTcpPingDiagnosis(inNode, targetIp, targetPort, "转发->目标")
			results = append(results, result)
		}
	} else {
		// Tunnel forward: inNode -> outNode, outNode -> targets
		outNode := GetNodeById(tunnel.OutNodeId)
		if outNode == nil {
			return dto.Err("出口节点不存在")
		}

		// inNode TCP ping outNode
		inToOutResult := performTcpPingDiagnosis(inNode, outNode.ServerIp, forward.OutPort, "入口->出口")
		results = append(results, inToOutResult)

		// outNode TCP ping targets
		for _, addr := range remoteAddresses {
			targetIp := extractIpFromAddress(addr)
			targetPort := extractPortFromAddress(addr)
			if targetIp == "" || targetPort == -1 {
				return dto.Err("无法解析目标地址: " + addr)
			}
			outToTargetResult := performTcpPingDiagnosis(outNode, targetIp, targetPort, "出口->目标")
			results = append(results, outToTargetResult)
		}
	}

	// Build diagnosis report
	tunnelTypeStr := "端口转发"
	if tunnel.Type != tunnelTypePortForward {
		tunnelTypeStr = "隧道转发"
	}

	report := map[string]interface{}{
		"forwardId":   id,
		"forwardName": forward.Name,
		"tunnelType":  tunnelTypeStr,
		"results":     results,
		"timestamp":   time.Now().UnixMilli(),
	}

	return dto.Ok(report)
}

func UpdateForwardOrder(data map[string]interface{}, userId int64, roleId int) dto.R {
	rawForwards, ok := data["forwards"]
	if !ok {
		return dto.Err("缺少forwards参数")
	}

	// Parse forwards array - handle JSON unmarshaling
	var items []dto.ForwardOrderItem
	jsonBytes, err := json.Marshal(rawForwards)
	if err != nil {
		return dto.Err("forwards参数格式错误")
	}
	if err := json.Unmarshal(jsonBytes, &items); err != nil {
		return dto.Err("forwards参数格式错误")
	}
	if len(items) == 0 {
		return dto.Err("forwards参数不能为空")
	}

	// Non-admin: verify all forwards belong to the user
	if roleId != adminRoleId {
		ids := make([]int64, len(items))
		for i, item := range items {
			ids[i] = item.ID
		}
		var count int64
		DB.Model(&model.Forward{}).Where("id IN ? AND user_id = ?", ids, userId).Count(&count)
		if count != int64(len(ids)) {
			return dto.Err("只能更新自己的转发排序")
		}
	}

	// Batch update inx
	for _, item := range items {
		DB.Model(&model.Forward{}).Where("id = ?", item.ID).Update("inx", item.Inx)
	}

	return dto.Ok("排序更新成功")
}

// UpdateForwardA is called internally (e.g., by flow service) to refresh GOST config
func UpdateForwardA(forward *model.Forward) {
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, forward.TunnelId).Error; err != nil {
		return
	}

	// Override tunnel listen address if forward has custom listenIp
	if forward.ListenIp != "" {
		tunnel.TcpListenAddr = forward.ListenIp
		tunnel.UdpListenAddr = forward.ListenIp
	}

	userTunnel := getUserTunnel(forward.UserId, tunnel.ID)
	inNode, outNode, nodeErr := getRequiredNodes(&tunnel)
	if nodeErr != "" {
		return
	}

	var limiterInt *int
	if userTunnel != nil && userTunnel.SpeedId != nil {
		v := int(*userTunnel.SpeedId)
		limiterInt = &v
	}

	serviceName := buildServiceName(forward.ID, forward.UserId, userTunnel)
	updateGostServices(forward, &tunnel, limiterInt, inNode, outNode, serviceName)
}

// ---------------------- Helper functions ----------------------

func checkUserPermissions(userId int64, roleId int, tunnel *model.Tunnel, excludeForwardId *int64) (limiter *int64, userTunnel *model.UserTunnel, errMsg string) {
	if roleId == adminRoleId {
		return nil, nil, ""
	}

	// Check user info
	var user model.User
	if err := DB.First(&user, userId).Error; err != nil {
		return nil, nil, "用户不存在"
	}
	if user.ExpTime != 0 && user.ExpTime <= time.Now().UnixMilli() {
		return nil, nil, "当前账号已到期"
	}

	// Check user tunnel permission
	ut := getUserTunnel(userId, tunnel.ID)
	if ut == nil {
		return nil, nil, "你没有该隧道权限"
	}
	if ut.Status != 1 {
		return nil, nil, "隧道被禁用"
	}
	if ut.ExpTime != 0 && ut.ExpTime <= time.Now().UnixMilli() {
		return nil, nil, "该隧道权限已到期"
	}

	// Flow limits — compare actual usage against limit (same logic as checkUserFlowLimits)
	if user.Flow*bytesToGB <= user.InFlow+user.OutFlow {
		return nil, nil, "用户总流量已用完"
	}
	if ut.Flow*bytesToGB <= ut.InFlow+ut.OutFlow {
		return nil, nil, "该隧道流量已用完"
	}

	// Forward quota
	quotaErr := checkForwardQuota(userId, tunnel.ID, ut, &user, excludeForwardId)
	if quotaErr != "" {
		return nil, nil, quotaErr
	}

	return ut.SpeedId, ut, ""
}

func checkForwardQuota(userId int64, tunnelId int64, userTunnel *model.UserTunnel, user *model.User, excludeForwardId *int64) string {
	// Check user total forward count (exclude current forward during edit)
	var userForwardCount int64
	userTx := DB.Model(&model.Forward{}).Where("user_id = ?", userId)
	if excludeForwardId != nil {
		userTx = userTx.Where("id != ?", *excludeForwardId)
	}
	userTx.Count(&userForwardCount)
	if userForwardCount >= int64(user.Num) {
		return fmt.Sprintf("用户总转发数量已达上限，当前限制：%d个", user.Num)
	}

	// Check user forward count on this tunnel
	tx := DB.Model(&model.Forward{}).Where("user_id = ? AND tunnel_id = ?", userId, tunnelId)
	if excludeForwardId != nil {
		tx = tx.Where("id != ?", *excludeForwardId)
	}
	var tunnelForwardCount int64
	tx.Count(&tunnelForwardCount)
	if tunnelForwardCount >= int64(userTunnel.Num) {
		return fmt.Sprintf("该隧道转发数量已达上限，当前限制：%d个", userTunnel.Num)
	}

	return ""
}

func checkUserFlowLimits(userId int64, tunnel *model.Tunnel) string {
	var user model.User
	if err := DB.First(&user, userId).Error; err != nil {
		return "用户不存在"
	}
	if user.ExpTime != 0 && user.ExpTime <= time.Now().UnixMilli() {
		return "当前账号已到期"
	}

	ut := getUserTunnel(userId, tunnel.ID)
	if ut == nil {
		return "你没有该隧道权限"
	}
	if ut.ExpTime != 0 && ut.ExpTime <= time.Now().UnixMilli() {
		return "该隧道权限已到期，无法恢复服务"
	}

	// Check user total flow
	if user.Flow*bytesToGB <= user.InFlow+user.OutFlow {
		return "用户总流量已用完，无法恢复服务"
	}

	// Check tunnel flow
	tunnelFlow := ut.InFlow + ut.OutFlow
	if ut.Flow*bytesToGB <= tunnelFlow {
		return "该隧道流量已用完，无法恢复服务"
	}

	return ""
}

func allocatePorts(tunnel *model.Tunnel, specifiedInPort *int, excludeForwardId *int64) (inPort int, outPort int, errMsg string) {
	if specifiedInPort != nil {
		// Specified port: check availability
		if !isInPortAvailable(tunnel, *specifiedInPort, excludeForwardId) {
			return 0, 0, fmt.Sprintf("指定的入口端口 %d 已被占用或不在允许范围内", *specifiedInPort)
		}
		inPort = *specifiedInPort
	} else {
		// Auto-allocate
		p := allocatePortForNode(tunnel.InNodeId, excludeForwardId)
		if p == nil {
			return 0, 0, "隧道入口端口已满，无法分配新端口"
		}
		inPort = *p
	}

	if tunnel.Type == tunnelTypeTunnelForward {
		p := allocatePortForNode(tunnel.OutNodeId, excludeForwardId)
		if p == nil {
			return 0, 0, "隧道出口端口已满，无法分配新端口"
		}
		outPort = *p
	}

	return inPort, outPort, ""
}

func isInPortAvailable(tunnel *model.Tunnel, port int, excludeForwardId *int64) bool {
	inNode := GetNodeById(tunnel.InNodeId)
	if inNode == nil {
		return false
	}
	if port < inNode.PortSta || port > inNode.PortEnd {
		return false
	}
	usedPorts := getAllUsedPortsOnNode(tunnel.InNodeId, excludeForwardId)
	return !usedPorts[port]
}

func allocatePortForNode(nodeId int64, excludeForwardId *int64) *int {
	node := GetNodeById(nodeId)
	if node == nil {
		return nil
	}
	usedPorts := getAllUsedPortsOnNode(nodeId, excludeForwardId)
	for port := node.PortSta; port <= node.PortEnd; port++ {
		if !usedPorts[port] {
			return &port
		}
	}
	return nil
}

func getAllUsedPortsOnNode(nodeId int64, excludeForwardId *int64) map[int]bool {
	usedPorts := make(map[int]bool)

	// 1. Collect in_port from forwards where tunnel.in_node_id = nodeId
	var inTunnelIds []int64
	DB.Model(&model.Tunnel{}).Where("in_node_id = ?", nodeId).Pluck("id", &inTunnelIds)
	if len(inTunnelIds) > 0 {
		tx := DB.Model(&model.Forward{}).Where("tunnel_id IN ?", inTunnelIds)
		if excludeForwardId != nil {
			tx = tx.Where("id != ?", *excludeForwardId)
		}
		var forwards []model.Forward
		tx.Select("in_port").Find(&forwards)
		for _, f := range forwards {
			if f.InPort != 0 {
				usedPorts[f.InPort] = true
			}
		}
	}

	// 2. Collect out_port from forwards where tunnel.out_node_id = nodeId
	var outTunnelIds []int64
	DB.Model(&model.Tunnel{}).Where("out_node_id = ?", nodeId).Pluck("id", &outTunnelIds)
	if len(outTunnelIds) > 0 {
		tx := DB.Model(&model.Forward{}).Where("tunnel_id IN ?", outTunnelIds)
		if excludeForwardId != nil {
			tx = tx.Where("id != ?", *excludeForwardId)
		}
		var forwards []model.Forward
		tx.Select("out_port").Find(&forwards)
		for _, f := range forwards {
			if f.OutPort != 0 {
				usedPorts[f.OutPort] = true
			}
		}
	}

	return usedPorts
}

func buildServiceName(forwardId int64, userId int64, userTunnel *model.UserTunnel) string {
	var userTunnelId int64
	if userTunnel != nil {
		userTunnelId = userTunnel.ID
	}
	return fmt.Sprintf("%d_%d_%d", forwardId, userId, userTunnelId)
}

func isGostSuccess(result *dto.GostResponse) bool {
	return result != nil && result.Msg == gostSuccessMsg
}

func validateForwardExists(forwardId int64, userId int64, roleId int) *model.Forward {
	var forward model.Forward
	if err := DB.First(&forward, forwardId).Error; err != nil {
		return nil
	}
	// Non-admin can only operate on own forwards
	if roleId != adminRoleId && userId != forward.UserId {
		return nil
	}
	return &forward
}

func getUserTunnel(userId int64, tunnelId int64) *model.UserTunnel {
	var ut model.UserTunnel
	if err := DB.Where("user_id = ? AND tunnel_id = ?", userId, tunnelId).First(&ut).Error; err != nil {
		return nil
	}
	return &ut
}

func getRequiredNodes(tunnel *model.Tunnel) (inNode *model.Node, outNode *model.Node, errMsg string) {
	inNode = GetNodeById(tunnel.InNodeId)
	if inNode == nil {
		return nil, nil, "入口节点不存在"
	}

	if tunnel.Type == tunnelTypeTunnelForward {
		outNode = GetNodeById(tunnel.OutNodeId)
		if outNode == nil {
			return nil, nil, "出口节点不存在"
		}
	}

	return inNode, outNode, ""
}

// ---------------------- GOST service management ----------------------

func createGostServices(forward *model.Forward, tunnel *model.Tunnel, limiter *int64, inNode *model.Node, outNode *model.Node, serviceName string) string {
	var limiterInt *int
	if limiter != nil {
		v := int(*limiter)
		limiterInt = &v
	}

	// Tunnel forward: create chains and remote service first
	if tunnel.Type == tunnelTypeTunnelForward {
		// Create chain on inNode
		chainRemoteAddr := formatRemoteAddr(tunnel.OutIp, forward.OutPort)
		chainResult := pkg.AddChains(inNode.ID, serviceName, chainRemoteAddr, tunnel.Protocol, tunnel.InterfaceName)
		if !isGostSuccess(chainResult) {
			pkg.DeleteChains(inNode.ID, serviceName)
			return chainResult.Msg
		}

		// Create remote service on outNode
		remoteResult := pkg.AddRemoteService(outNode.ID, serviceName, forward.OutPort, forward.RemoteAddr, tunnel.Protocol, forward.Strategy, forward.InterfaceName)
		if !isGostSuccess(remoteResult) {
			pkg.DeleteChains(inNode.ID, serviceName)
			pkg.DeleteRemoteService(outNode.ID, serviceName)
			return remoteResult.Msg
		}
	}

	// Determine interface name: only for port forward (not tunnel forward)
	interfaceName := ""
	if tunnel.Type != tunnelTypeTunnelForward {
		interfaceName = forward.InterfaceName
	}

	// Create main service on inNode
	serviceResult := pkg.AddService(inNode.ID, serviceName, forward.InPort, limiterInt, forward.RemoteAddr, tunnel.Type, tunnel, forward.Strategy, interfaceName)
	if !isGostSuccess(serviceResult) {
		pkg.DeleteChains(inNode.ID, serviceName)
		if outNode != nil {
			pkg.DeleteRemoteService(outNode.ID, serviceName)
		}
		return serviceResult.Msg
	}

	return ""
}

func updateGostServices(forward *model.Forward, tunnel *model.Tunnel, limiter *int, inNode *model.Node, outNode *model.Node, serviceName string) string {
	errStr := syncGostServices(forward, tunnel, limiter, inNode, outNode, serviceName)
	if errStr != "" {
		updateForwardStatusToError(forward.ID)
	}
	return errStr
}

// syncGostServices sends GOST service configurations to nodes.
// Returns error message on failure, empty string on success.
// Does NOT change forward status in DB — callers decide whether to set error status.
func syncGostServices(forward *model.Forward, tunnel *model.Tunnel, limiter *int, inNode *model.Node, outNode *model.Node, serviceName string) string {
	if tunnel.Type == tunnelTypeTunnelForward {
		// Update chain
		chainRemoteAddr := formatRemoteAddr(tunnel.OutIp, forward.OutPort)
		chainResult := pkg.UpdateChains(inNode.ID, serviceName, chainRemoteAddr, tunnel.Protocol, tunnel.InterfaceName)
		if strings.Contains(chainResult.Msg, gostNotFoundMsg) {
			chainResult = pkg.AddChains(inNode.ID, serviceName, chainRemoteAddr, tunnel.Protocol, tunnel.InterfaceName)
		}
		if !isGostSuccess(chainResult) {
			return chainResult.Msg
		}

		// Update remote service
		remoteResult := pkg.UpdateRemoteService(outNode.ID, serviceName, forward.OutPort, forward.RemoteAddr, tunnel.Protocol, forward.Strategy, forward.InterfaceName)
		if strings.Contains(remoteResult.Msg, gostNotFoundMsg) {
			remoteResult = pkg.AddRemoteService(outNode.ID, serviceName, forward.OutPort, forward.RemoteAddr, tunnel.Protocol, forward.Strategy, forward.InterfaceName)
		}
		if !isGostSuccess(remoteResult) {
			return remoteResult.Msg
		}
	}

	// Update main service
	interfaceName := ""
	if tunnel.Type != tunnelTypeTunnelForward {
		interfaceName = forward.InterfaceName
	}

	serviceResult := pkg.UpdateService(inNode.ID, serviceName, forward.InPort, limiter, forward.RemoteAddr, tunnel.Type, tunnel, forward.Strategy, interfaceName)
	if strings.Contains(serviceResult.Msg, gostNotFoundMsg) {
		serviceResult = pkg.AddService(inNode.ID, serviceName, forward.InPort, limiter, forward.RemoteAddr, tunnel.Type, tunnel, forward.Strategy, interfaceName)
	}
	if !isGostSuccess(serviceResult) {
		return serviceResult.Msg
	}

	return ""
}

func deleteGostServices(tunnel *model.Tunnel, inNode *model.Node, outNode *model.Node, serviceName string) string {
	return deleteGostServicesWithIP(tunnel, inNode, outNode, serviceName, "")
}

func deleteGostServicesWithIP(tunnel *model.Tunnel, inNode *model.Node, outNode *model.Node, serviceName string, listenIp string) string {
	// Delete main service (ignore "not found" — already gone)
	var serviceResult *dto.GostResponse
	if listenIp != "" && strings.Contains(listenIp, ",") {
		serviceResult = pkg.DeleteServiceMultiIP(inNode.ID, serviceName, listenIp)
	} else {
		serviceResult = pkg.DeleteService(inNode.ID, serviceName)
	}
	if !isGostSuccess(serviceResult) && !strings.Contains(serviceResult.Msg, gostNotFoundMsg) {
		return serviceResult.Msg
	}

	// Tunnel forward: also delete chains and remote service
	if tunnel.Type == tunnelTypeTunnelForward {
		chainResult := pkg.DeleteChains(inNode.ID, serviceName)
		if !isGostSuccess(chainResult) && !strings.Contains(chainResult.Msg, gostNotFoundMsg) {
			return chainResult.Msg
		}
		if outNode != nil {
			remoteResult := pkg.DeleteRemoteService(outNode.ID, serviceName)
			if !isGostSuccess(remoteResult) && !strings.Contains(remoteResult.Msg, gostNotFoundMsg) {
				return remoteResult.Msg
			}
		}
	}

	return ""
}

func deleteOldGostServices(forward *model.Forward, oldTunnel *model.Tunnel) {
	oldUserTunnel := getUserTunnel(forward.UserId, oldTunnel.ID)
	serviceName := buildServiceName(forward.ID, forward.UserId, oldUserTunnel)

	oldInNode, oldOutNode, nodeErr := getRequiredNodes(oldTunnel)

	// Delete main service
	if nodeErr == "" && oldInNode != nil {
		var result *dto.GostResponse
		if forward.ListenIp != "" && strings.Contains(forward.ListenIp, ",") {
			result = pkg.DeleteServiceMultiIP(oldInNode.ID, serviceName, forward.ListenIp)
		} else {
			result = pkg.DeleteService(oldInNode.ID, serviceName)
		}
		if !isGostSuccess(result) {
			log.Printf("删除主服务失败: %s", result.Msg)
		}
	}

	// Tunnel forward: delete chains and remote service
	if oldTunnel.Type == tunnelTypeTunnelForward {
		if nodeErr == "" && oldInNode != nil {
			result := pkg.DeleteChains(oldInNode.ID, serviceName)
			if !isGostSuccess(result) {
				log.Printf("删除链服务失败: %s", result.Msg)
			}
		}

		var outNode *model.Node
		if nodeErr == "" {
			outNode = oldOutNode
		} else {
			outNode = GetNodeById(oldTunnel.OutNodeId)
		}
		if outNode != nil {
			result := pkg.DeleteRemoteService(outNode.ID, serviceName)
			if !isGostSuccess(result) {
				log.Printf("删除远程服务失败: %s", result.Msg)
			}
		}
	}
}

func updateForwardStatusToError(forwardId int64) {
	DB.Model(&model.Forward{}).Where("id = ?", forwardId).Update("status", forwardStatusError)
}

// ---------------------- SSRF protection ----------------------

// isPrivateIP checks if an IP is in a private/reserved range.
func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	privateRanges := []string{
		"127.0.0.0/8",
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"169.254.0.0/16",
		"::1/128",
		"fc00::/7",
		"fe80::/10",
	}
	for _, cidr := range privateRanges {
		_, network, err := net.ParseCIDR(cidr)
		if err == nil && network.Contains(ip) {
			return true
		}
	}
	return false
}

// validateRemoteAddr checks that none of the comma-separated addresses
// point to private/reserved IPs. Resolves domain names to catch DNS rebinding.
// Admin users bypass this check.
func validateRemoteAddr(remoteAddr string, roleId int) string {
	if roleId == adminRoleId {
		return "" // Admin can forward to any address
	}
	addrs := strings.Split(remoteAddr, ",")
	for _, addr := range addrs {
		host := extractIpFromAddress(strings.TrimSpace(addr))
		if host == "" {
			continue
		}
		// Check literal IP first
		if isPrivateIP(host) {
			return fmt.Sprintf("禁止转发到内网地址: %s", host)
		}
		// If host is a domain name, resolve and check all IPs
		if net.ParseIP(host) == nil {
			ips, err := net.LookupIP(host)
			if err == nil {
				for _, ip := range ips {
					if isPrivateIP(ip.String()) {
						return fmt.Sprintf("禁止转发到内网地址: %s (解析为 %s)", host, ip)
					}
				}
			}
		}
	}
	return ""
}

// ---------------------- Address parsing helpers ----------------------

func formatRemoteAddr(ip string, port int) string {
	if strings.Contains(ip, ":") {
		return fmt.Sprintf("[%s]:%d", ip, port)
	}
	return fmt.Sprintf("%s:%d", ip, port)
}

func extractIpFromAddress(address string) string {
	address = strings.TrimSpace(address)
	if address == "" {
		return ""
	}

	// IPv6: [ipv6]:port
	if strings.HasPrefix(address, "[") {
		closeBracket := strings.Index(address, "]")
		if closeBracket > 1 {
			return address[1:closeBracket]
		}
	}

	// IPv4 or domain: host:port
	lastColon := strings.LastIndex(address, ":")
	if lastColon > 0 {
		return address[:lastColon]
	}

	return address
}

func extractPortFromAddress(address string) int {
	address = strings.TrimSpace(address)
	if address == "" {
		return -1
	}

	// IPv6: [ipv6]:port
	if strings.HasPrefix(address, "[") {
		closeBracket := strings.Index(address, "]")
		if closeBracket > 1 && closeBracket+1 < len(address) && address[closeBracket+1] == ':' {
			portStr := address[closeBracket+2:]
			port := 0
			for _, c := range portStr {
				if c < '0' || c > '9' {
					return -1
				}
				port = port*10 + int(c-'0')
			}
			return port
		}
	}

	// IPv4 or domain: host:port
	lastColon := strings.LastIndex(address, ":")
	if lastColon > 0 && lastColon+1 < len(address) {
		portStr := address[lastColon+1:]
		port := 0
		for _, c := range portStr {
			if c < '0' || c > '9' {
				return -1
			}
			port = port*10 + int(c-'0')
		}
		return port
	}

	return -1
}

// ---------------------- TCP Ping Diagnosis ----------------------

func performTcpPingDiagnosis(node *model.Node, targetIp string, port int, description string) DiagnosisResult {
	result := DiagnosisResult{
		NodeId:      node.ID,
		NodeName:    node.Name,
		TargetIp:    targetIp,
		TargetPort:  port,
		Description: description,
		Timestamp:   time.Now().UnixMilli(),
	}

	tcpPingData := map[string]interface{}{
		"ip":      targetIp,
		"port":    port,
		"count":   2,
		"timeout": 3000,
	}

	gostResult := pkg.WS.SendMsg(node.ID, tcpPingData, "TcpPing")

	if gostResult != nil && gostResult.Msg == gostSuccessMsg {
		if gostResult.Data != nil {
			// Try to parse the response data
			dataBytes, err := json.Marshal(gostResult.Data)
			if err == nil {
				var tcpPingResp map[string]interface{}
				if err := json.Unmarshal(dataBytes, &tcpPingResp); err == nil {
					success, _ := tcpPingResp["success"].(bool)
					result.Success = success
					if success {
						result.Message = "TCP连接成功"
						if avg, ok := tcpPingResp["averageTime"].(float64); ok {
							result.AverageTime = avg
						}
						if loss, ok := tcpPingResp["packetLoss"].(float64); ok {
							result.PacketLoss = loss
						}
					} else {
						if errMsg, ok := tcpPingResp["errorMessage"].(string); ok {
							result.Message = errMsg
						}
						result.AverageTime = -1
						result.PacketLoss = 100
					}
					return result
				}
			}
			// Could not parse detailed data but command succeeded
			result.Success = true
			result.Message = "TCP连接成功，但无法解析详细数据"
		} else {
			result.Success = true
			result.Message = "TCP连接成功"
		}
	} else {
		result.Success = false
		if gostResult != nil {
			result.Message = gostResult.Msg
		} else {
			result.Message = "节点无响应"
		}
		result.AverageTime = -1
		result.PacketLoss = 100
	}

	return result
}
