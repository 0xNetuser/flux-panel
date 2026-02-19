package service

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"net/url"
	"strings"
	"time"
)

// streamSettings represents the parsed stream_settings_json from an inbound
type streamSettings struct {
	Network  string `json:"network"`
	Security string `json:"security"`

	WsSettings struct {
		Path    string            `json:"path"`
		Headers map[string]string `json:"headers"`
	} `json:"wsSettings"`

	GrpcSettings struct {
		ServiceName string `json:"serviceName"`
	} `json:"grpcSettings"`

	TcpSettings struct {
		Header struct {
			Type    string `json:"type"`
			Request struct {
				Path    []string            `json:"path"`
				Headers map[string][]string `json:"headers"`
			} `json:"request"`
		} `json:"header"`
	} `json:"tcpSettings"`

	HttpupgradeSettings struct {
		Path string `json:"path"`
		Host string `json:"host"`
	} `json:"httpupgradeSettings"`

	XhttpSettings struct {
		Path string `json:"path"`
		Host string `json:"host"`
	} `json:"xhttpSettings"`

	KcpSettings struct {
		Header struct {
			Type string `json:"type"`
		} `json:"header"`
		Seed string `json:"seed"`
	} `json:"kcpSettings"`

	TlsSettings struct {
		ServerName  string   `json:"serverName"`
		Fingerprint string   `json:"fingerprint"`
		Alpn        []string `json:"alpn"`
	} `json:"tlsSettings"`

	RealitySettings struct {
		ServerNames []string `json:"serverNames"`
		PublicKey   string   `json:"publicKey"`
		ShortIds    []string `json:"shortIds"`
		SpiderX     string   `json:"spiderX"`
		Fingerprint string   `json:"fingerprint"`
	} `json:"realitySettings"`
}

// inboundSettings represents the parsed settings_json from an inbound
type inboundSettings struct {
	Method string `json:"method"`
}

func parseStreamSettings(jsonStr string) *streamSettings {
	if jsonStr == "" {
		return &streamSettings{}
	}
	var ss streamSettings
	if err := json.Unmarshal([]byte(jsonStr), &ss); err != nil {
		return &streamSettings{}
	}
	return &ss
}

func parseInboundSettings(jsonStr string) *inboundSettings {
	if jsonStr == "" {
		return &inboundSettings{}
	}
	var is inboundSettings
	if err := json.Unmarshal([]byte(jsonStr), &is); err != nil {
		return &inboundSettings{}
	}
	return &is
}

func CreateXrayClient(d dto.XrayClientDto, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var inbound model.XrayInbound
	if err := DB.First(&inbound, d.InboundId).Error; err != nil {
		return dto.Err("入站不存在")
	}

	// Check node access via inbound's node
	if r := checkXrayNodeAccess(userId, roleId, inbound.NodeId); r != nil {
		return *r
	}

	// Non-admin: force bind to self
	if roleId != 0 {
		d.UserId = userId
	}

	if d.UserId > 0 {
		var user model.User
		if err := DB.First(&user, d.UserId).Error; err != nil {
			return dto.Err("用户不存在")
		}
	}

	client := model.XrayClient{
		InboundId:    d.InboundId,
		UserId:       d.UserId,
		Flow:         d.Flow,
		AlterId:      0,
		TotalTraffic: 0,
		UpTraffic:    0,
		DownTraffic:  0,
		Enable:       1,
		TgId:         d.TgId,
		Remark:       d.Remark,
		CreatedTime:  time.Now().UnixMilli(),
		UpdatedTime:  time.Now().UnixMilli(),
	}

	if d.AlterId != nil {
		client.AlterId = *d.AlterId
	}
	if d.TotalTraffic != nil {
		client.TotalTraffic = *d.TotalTraffic
	}
	if d.ExpTime != nil {
		client.ExpTime = d.ExpTime
	}
	if d.LimitIp != nil {
		client.LimitIp = *d.LimitIp
	}
	if d.Reset != nil {
		client.Reset = *d.Reset
	}

	// Generate or use provided subId
	if d.SubId != "" {
		client.SubId = d.SubId
	} else {
		client.SubId = pkg.GenerateRandomString(16)
	}

	// Generate UUID or use specified password
	if d.UuidOrPassword != "" {
		client.UuidOrPassword = d.UuidOrPassword
	} else {
		if inbound.Protocol == "shadowsocks" {
			client.UuidOrPassword = generateRandomString(16)
		} else {
			client.UuidOrPassword = generateUUID()
		}
	}

	// Generate email
	client.Email = fmt.Sprintf("%d_%d@flux", d.UserId, time.Now().UnixMilli())

	if err := DB.Create(&client).Error; err != nil {
		return dto.Err("创建客户端失败")
	}

	// Add client via gRPC
	node := GetNodeById(inbound.NodeId)
	if node != nil {
		result := pkg.XrayAddClient(node.ID, inbound.Tag, client.Email, client.UuidOrPassword, client.Flow, client.AlterId, inbound.Protocol)
		if result != nil && result.Msg != "OK" {
			log.Printf("下发 XrayAddClient 到节点 %d 失败: %s", node.ID, result.Msg)
		}
	}

	return dto.Ok(client)
}

func ListXrayClients(inboundId, userIdFilter *int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	query := DB.Model(&model.XrayClient{}).Order("created_time DESC")

	if roleId != 0 {
		// Non-admin: only see own clients
		query = query.Where("user_id = ?", userId)

		// Also filter by accessible node inbounds
		nodeIds := getUserAccessibleNodeIds(userId)
		query = query.Where("inbound_id IN (?)",
			DB.Model(&model.XrayInbound{}).Select("id").Where("node_id IN ?", nodeIds))
	} else {
		// Admin: apply optional filters
		if userIdFilter != nil {
			query = query.Where("user_id = ?", *userIdFilter)
		}
	}

	if inboundId != nil {
		query = query.Where("inbound_id = ?", *inboundId)
	}

	var list []model.XrayClient
	query.Find(&list)
	return dto.Ok(list)
}

func UpdateXrayClient(d dto.XrayClientUpdateDto, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var existing model.XrayClient
	if err := DB.First(&existing, d.ID).Error; err != nil {
		return dto.Err("客户端不存在")
	}

	// Non-admin: must own this client
	if roleId != 0 && existing.UserId != userId {
		return dto.Err("无权操作此客户端")
	}

	// Check node access via inbound
	var inbound model.XrayInbound
	if err := DB.First(&inbound, existing.InboundId).Error; err == nil {
		if r := checkXrayNodeAccess(userId, roleId, inbound.NodeId); r != nil {
			return *r
		}
	}

	updates := map[string]interface{}{"updated_time": time.Now().UnixMilli()}
	if d.Flow != "" {
		updates["flow"] = d.Flow
	}
	if d.AlterId != nil {
		updates["alter_id"] = *d.AlterId
	}
	if d.TotalTraffic != nil {
		updates["total_traffic"] = *d.TotalTraffic
	}
	if d.ExpTime != nil {
		updates["exp_time"] = *d.ExpTime
	}
	if d.LimitIp != nil {
		updates["limit_ip"] = *d.LimitIp
	}
	if d.Reset != nil {
		updates["reset"] = *d.Reset
	}
	if d.TgId != "" {
		updates["tg_id"] = d.TgId
	}
	if d.SubId != "" {
		updates["sub_id"] = d.SubId
	}
	if d.Enable != nil {
		updates["enable"] = *d.Enable
	}
	if d.Remark != "" {
		updates["remark"] = d.Remark
	}

	DB.Model(&existing).Updates(updates)

	// Handle enable/disable via gRPC
	if d.Enable != nil {
		if err := DB.First(&inbound, existing.InboundId).Error; err == nil {
			node := GetNodeById(inbound.NodeId)
			if node != nil {
				if *d.Enable == 0 {
					pkg.XrayRemoveClient(node.ID, inbound.Tag, existing.Email)
				} else {
					pkg.XrayAddClient(node.ID, inbound.Tag, existing.Email, existing.UuidOrPassword, existing.Flow, existing.AlterId, inbound.Protocol)
				}
			}
		}
	}

	return dto.Ok("更新成功")
}

func DeleteXrayClient(id int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var client model.XrayClient
	if err := DB.First(&client, id).Error; err != nil {
		return dto.Err("客户端不存在")
	}

	// Non-admin: must own this client
	if roleId != 0 && client.UserId != userId {
		return dto.Err("无权操作此客户端")
	}

	// Check node access via inbound
	var inbound model.XrayInbound
	DB.First(&inbound, client.InboundId)

	if inbound.ID > 0 {
		if r := checkXrayNodeAccess(userId, roleId, inbound.NodeId); r != nil {
			return *r
		}
	}

	DB.Delete(&client)

	if inbound.ID > 0 {
		node := GetNodeById(inbound.NodeId)
		if node != nil {
			result := pkg.XrayRemoveClient(node.ID, inbound.Tag, client.Email)
			if result != nil && result.Msg != "OK" {
				log.Printf("下发 XrayRemoveClient 到节点 %d 失败: %s", node.ID, result.Msg)
			}
		}
	}

	return dto.Ok("删除成功")
}

func ResetXrayClientTraffic(id int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var client model.XrayClient
	if err := DB.First(&client, id).Error; err != nil {
		return dto.Err("客户端不存在")
	}

	// Non-admin: must own this client
	if roleId != 0 && client.UserId != userId {
		return dto.Err("无权操作此客户端")
	}

	DB.Model(&client).Updates(map[string]interface{}{
		"up_traffic":   0,
		"down_traffic": 0,
		"updated_time": time.Now().UnixMilli(),
	})

	return dto.Ok("流量已重置")
}

func GetSubscriptionLinks(userId int64) dto.R {
	// Check Xray permission
	var user model.User
	if err := DB.First(&user, userId).Error; err != nil {
		return dto.Err("用户不存在")
	}
	if user.RoleId != 0 && user.XrayEnabled != 1 {
		return dto.Ok([]map[string]interface{}{})
	}

	var clients []model.XrayClient
	DB.Where("user_id = ? AND enable = 1", userId).Find(&clients)

	var links []map[string]interface{}

	for _, client := range clients {
		var inbound model.XrayInbound
		if err := DB.First(&inbound, client.InboundId).Error; err != nil || inbound.Enable != 1 {
			continue
		}

		node := GetNodeById(inbound.NodeId)
		if node == nil || node.Status != 1 {
			continue
		}

		// Node access check for non-admin users
		if user.RoleId != 0 && !UserHasNodeAccess(userId, node.ID) {
			continue
		}

		link := generateProtocolLink(&client, &inbound, node)
		if link != "" {
			remark := client.Remark
			if remark == "" {
				remark = inbound.Remark
			}
			if remark == "" {
				remark = inbound.Tag
			}

			links = append(links, map[string]interface{}{
				"link":     link,
				"protocol": inbound.Protocol,
				"remark":   remark,
				"nodeName": node.Name,
			})
		}
	}

	return dto.Ok(links)
}

func generateProtocolLink(client *model.XrayClient, inbound *model.XrayInbound, node *model.Node) string {
	host := node.ServerIp
	port := inbound.Port
	remark := client.Remark
	if remark == "" {
		remark = inbound.Remark
	}
	if remark == "" {
		remark = inbound.Tag
	}

	ss := parseStreamSettings(inbound.StreamSettingsJson)
	is := parseInboundSettings(inbound.SettingsJson)

	switch inbound.Protocol {
	case "vmess":
		return generateVmessLink(client, host, port, remark, ss)
	case "vless":
		return generateVlessLink(client, host, port, remark, ss)
	case "trojan":
		return generateTrojanLink(client, host, port, remark, ss)
	case "shadowsocks":
		return generateShadowsocksLink(client, host, port, remark, is)
	default:
		return ""
	}
}

// streamPath returns the path for the current network type
func streamPath(ss *streamSettings) string {
	switch ss.Network {
	case "ws":
		return ss.WsSettings.Path
	case "grpc":
		return ss.GrpcSettings.ServiceName
	case "httpupgrade":
		return ss.HttpupgradeSettings.Path
	case "xhttp", "splithttp":
		return ss.XhttpSettings.Path
	case "tcp":
		if len(ss.TcpSettings.Header.Request.Path) > 0 {
			return ss.TcpSettings.Header.Request.Path[0]
		}
	case "kcp", "mkcp":
		return ss.KcpSettings.Seed
	}
	return ""
}

// streamHost returns the host for the current network type
func streamHost(ss *streamSettings) string {
	switch ss.Network {
	case "ws":
		return ss.WsSettings.Headers["Host"]
	case "httpupgrade":
		return ss.HttpupgradeSettings.Host
	case "xhttp", "splithttp":
		return ss.XhttpSettings.Host
	case "tcp":
		if hosts, ok := ss.TcpSettings.Header.Request.Headers["Host"]; ok && len(hosts) > 0 {
			return hosts[0]
		}
	}
	return ""
}

// streamHeaderType returns the header type for tcp/kcp
func streamHeaderType(ss *streamSettings) string {
	switch ss.Network {
	case "tcp":
		return ss.TcpSettings.Header.Type
	case "kcp", "mkcp":
		return ss.KcpSettings.Header.Type
	}
	return ""
}

func generateVmessLink(client *model.XrayClient, host string, port int, remark string, ss *streamSettings) string {
	net := ss.Network
	if net == "" {
		net = "tcp"
	}

	tlsStr := ""
	if ss.Security == "tls" {
		tlsStr = "tls"
	}

	sni := ""
	fp := ""
	alpnStr := ""
	if ss.Security == "tls" {
		sni = ss.TlsSettings.ServerName
		fp = ss.TlsSettings.Fingerprint
		if len(ss.TlsSettings.Alpn) > 0 {
			alpnStr = strings.Join(ss.TlsSettings.Alpn, ",")
		}
	}

	config := map[string]interface{}{
		"v":    "2",
		"ps":   remark,
		"add":  host,
		"port": port,
		"id":   client.UuidOrPassword,
		"aid":  client.AlterId,
		"scy":  "auto",
		"net":  net,
		"type": streamHeaderType(ss),
		"host": streamHost(ss),
		"path": streamPath(ss),
		"tls":  tlsStr,
		"sni":  sni,
		"fp":   fp,
		"alpn": alpnStr,
	}

	// Clean empty values for cleaner JSON
	if config["type"] == "" {
		config["type"] = "none"
	}

	jsonBytes, _ := json.Marshal(config)
	encoded := base64.StdEncoding.EncodeToString(jsonBytes)
	return "vmess://" + encoded
}

// addTransportParams appends transport & security query params for vless/trojan links
func addTransportParams(params url.Values, ss *streamSettings) {
	net := ss.Network
	if net == "" {
		net = "tcp"
	}
	params.Set("type", net)

	if p := streamPath(ss); p != "" {
		params.Set("path", p)
	}
	if h := streamHost(ss); h != "" {
		params.Set("host", h)
	}
	if ht := streamHeaderType(ss); ht != "" && ht != "none" {
		params.Set("headerType", ht)
	}
	if ss.Network == "grpc" {
		params.Set("serviceName", ss.GrpcSettings.ServiceName)
	}
	if ss.Network == "kcp" || ss.Network == "mkcp" {
		if ss.KcpSettings.Seed != "" {
			params.Set("seed", ss.KcpSettings.Seed)
		}
	}

	security := ss.Security
	if security == "" {
		security = "none"
	}
	params.Set("security", security)

	if ss.Security == "tls" {
		if ss.TlsSettings.ServerName != "" {
			params.Set("sni", ss.TlsSettings.ServerName)
		}
		if ss.TlsSettings.Fingerprint != "" {
			params.Set("fp", ss.TlsSettings.Fingerprint)
		}
		if len(ss.TlsSettings.Alpn) > 0 {
			params.Set("alpn", strings.Join(ss.TlsSettings.Alpn, ","))
		}
	}

	if ss.Security == "reality" {
		if len(ss.RealitySettings.ServerNames) > 0 {
			params.Set("sni", ss.RealitySettings.ServerNames[0])
		}
		if ss.RealitySettings.PublicKey != "" {
			params.Set("pbk", ss.RealitySettings.PublicKey)
		}
		if len(ss.RealitySettings.ShortIds) > 0 {
			params.Set("sid", ss.RealitySettings.ShortIds[0])
		}
		if ss.RealitySettings.SpiderX != "" {
			params.Set("spx", ss.RealitySettings.SpiderX)
		}
		if ss.RealitySettings.Fingerprint != "" {
			params.Set("fp", ss.RealitySettings.Fingerprint)
		}
	}
}

func generateVlessLink(client *model.XrayClient, host string, port int, remark string, ss *streamSettings) string {
	params := url.Values{}
	params.Set("encryption", "none")
	if client.Flow != "" {
		params.Set("flow", client.Flow)
	}
	addTransportParams(params, ss)
	return fmt.Sprintf("vless://%s@%s:%d?%s#%s", client.UuidOrPassword, host, port, params.Encode(), url.QueryEscape(remark))
}

func generateTrojanLink(client *model.XrayClient, host string, port int, remark string, ss *streamSettings) string {
	params := url.Values{}
	addTransportParams(params, ss)
	return fmt.Sprintf("trojan://%s@%s:%d?%s#%s", client.UuidOrPassword, host, port, params.Encode(), url.QueryEscape(remark))
}

func generateShadowsocksLink(client *model.XrayClient, host string, port int, remark string, is *inboundSettings) string {
	method := is.Method
	if method == "" {
		method = "aes-256-gcm"
	}
	userInfo := method + ":" + client.UuidOrPassword
	encoded := base64.StdEncoding.EncodeToString([]byte(userInfo))
	return fmt.Sprintf("ss://%s@%s:%d#%s", encoded, host, port, url.QueryEscape(remark))
}

func GetClientLink(clientId int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var client model.XrayClient
	if err := DB.First(&client, clientId).Error; err != nil {
		return dto.Err("客户端不存在")
	}

	// Non-admin: must own this client
	if roleId != 0 && client.UserId != userId {
		return dto.Err("无权操作此客户端")
	}

	var inbound model.XrayInbound
	if err := DB.First(&inbound, client.InboundId).Error; err != nil {
		return dto.Err("入站不存在")
	}

	if r := checkXrayNodeAccess(userId, roleId, inbound.NodeId); r != nil {
		return *r
	}

	node := GetNodeById(inbound.NodeId)
	if node == nil {
		return dto.Err("节点不存在")
	}

	link := generateProtocolLink(&client, &inbound, node)
	if link == "" {
		return dto.Err("不支持的协议")
	}

	remark := client.Remark
	if remark == "" {
		remark = inbound.Remark
	}
	if remark == "" {
		remark = inbound.Tag
	}

	return dto.Ok(map[string]interface{}{
		"link":     link,
		"protocol": inbound.Protocol,
		"remark":   remark,
	})
}

func generateRandomString(length int) string {
	return pkg.GenerateRandomString(length)
}

func generateUUID() string {
	return pkg.GenerateUUIDv4()
}
