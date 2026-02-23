package service

import (
	"fmt"
	"flux-panel/go-backend/config"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"math/rand"
	"strings"
	"time"
)

// disguisePool contains common Linux daemon names used to camouflage node processes.
var disguisePool = []string{
	"accounts-daemon", "dbus-broker", "networkd-dispatcher",
	"udisksd", "packagekitd", "polkitd", "colord-sane",
	"rtkit-daemon", "upower-daemon", "thermald",
	"irqbalance", "lldpd", "smartd", "avahi-daemon",
	"cupsd", "bluetoothd", "ModemManager",
}

// pickDisguiseNames selects two distinct random names from the disguise pool.
func pickDisguiseNames() (string, string) {
	indices := rand.Perm(len(disguisePool))
	return disguisePool[indices[0]], disguisePool[indices[1]]
}

func CreateNode(d dto.NodeDto) dto.R {
	if d.PortSta >= d.PortEnd {
		return dto.Err("起始端口必须小于结束端口")
	}

	disguise, xrayDisguise := pickDisguiseNames()

	node := model.Node{
		Name:             d.Name,
		Ip:               d.Ip,
		EntryIps:         d.EntryIps,
		ServerIp:         d.ServerIp,
		PortSta:          d.PortSta,
		PortEnd:          d.PortEnd,
		Secret:           pkg.GenerateSecureSecret(),
		Status:           0,
		CreatedTime:      time.Now().UnixMilli(),
		UpdatedTime:      time.Now().UnixMilli(),
		DisguiseName:     disguise,
		XrayDisguiseName: xrayDisguise,
	}

	if err := DB.Create(&node).Error; err != nil {
		return dto.Err("创建节点失败")
	}
	return dto.Ok(node)
}

func GetAllNodes() dto.R {
	var nodes []model.Node
	DB.Order("inx ASC, created_time DESC").Find(&nodes)

	result := make([]map[string]interface{}, 0, len(nodes))
	for _, n := range nodes {
		status := n.Status
		if pkg.WS != nil && pkg.WS.IsNodeOnline(n.ID) {
			status = 1
		}

		item := map[string]interface{}{
			"id":          n.ID,
			"name":        n.Name,
			"ip":          n.Ip,
			"entryIps":    n.EntryIps,
			"serverIp":    n.ServerIp,
			"portSta":     n.PortSta,
			"portEnd":     n.PortEnd,
			"secret":      n.Secret,
			"version":     n.Version,
			"http":        n.Http,
			"tls":         n.Tls,
			"socks":       n.Socks,
			"xrayEnabled": n.XrayEnabled,
			"xrayVersion": n.XrayVersion,
			"xrayStatus":  n.XrayStatus,
			// Frontend expects vVersion/vStatus
			"vVersion": n.XrayVersion,
			"vStatus":  n.XrayStatus,
			"createdTime": n.CreatedTime,
			"updatedTime": n.UpdatedTime,
			"status":           status,
			"inx":              n.Inx,
			"disguiseName":     n.DisguiseName,
			"xrayDisguiseName": n.XrayDisguiseName,
		}

		// Overlay live system info from WS cache
		if pkg.WS != nil {
			if info := pkg.WS.GetNodeSystemInfo(n.ID); info != nil {
				item["cpuUsage"] = info.CPUUsage
				item["memUsage"] = info.MemoryUsage
				item["uptime"] = info.Uptime
				item["bytesReceived"] = info.BytesReceived
				item["bytesTransmitted"] = info.BytesTransmitted
				item["interfaces"] = info.Interfaces
				item["runtime"] = info.Runtime
				item["panelAddr"] = info.PanelAddr
				if info.XrayVersion != "" {
					item["xrayVersion"] = info.XrayVersion
					item["vVersion"] = info.XrayVersion
				}
			}
		}

		result = append(result, item)
	}

	return dto.Ok(result)
}

func UpdateNode(d dto.NodeUpdateDto) dto.R {
	var node model.Node
	if err := DB.First(&node, d.ID).Error; err != nil {
		return dto.Err("节点不存在")
	}

	updates := map[string]interface{}{
		"updated_time": time.Now().UnixMilli(),
	}

	if d.Name != "" {
		updates["name"] = d.Name
	}
	if d.Ip != "" {
		updates["ip"] = d.Ip
	}
	// EntryIps can be set to empty string to clear, so always update if present in request
	updates["entry_ips"] = d.EntryIps
	if d.ServerIp != "" {
		oldServerIp := node.ServerIp
		updates["server_ip"] = d.ServerIp

		// Update tunnel IPs if server IP changed
		if oldServerIp != d.ServerIp {
			DB.Model(&model.Tunnel{}).Where("in_node_id = ?", d.ID).Update("in_ip", d.ServerIp)
			DB.Model(&model.Tunnel{}).Where("out_node_id = ?", d.ID).Update("out_ip", d.ServerIp)
		}
	}
	if d.PortSta != nil {
		updates["port_sta"] = *d.PortSta
	}
	if d.PortEnd != nil {
		updates["port_end"] = *d.PortEnd
	}

	if err := DB.Model(&node).Updates(updates).Error; err != nil {
		return dto.Err("更新节点失败")
	}
	return dto.Ok("节点更新成功")
}

func DeleteNode(id int64) dto.R {
	var node model.Node
	if err := DB.First(&node, id).Error; err != nil {
		return dto.Err("节点不存在")
	}

	// Check if node is used by any tunnel
	var count int64
	DB.Model(&model.Tunnel{}).Where("in_node_id = ? OR out_node_id = ?", id, id).Count(&count)
	if count > 0 {
		return dto.Err("该节点正在被隧道使用，无法删除")
	}

	// Cascade cleanup: Xray inbounds + their clients (best-effort hot-remove)
	var inbounds []model.XrayInbound
	DB.Where("node_id = ?", id).Find(&inbounds)
	for _, ib := range inbounds {
		pkg.XrayRemoveInbound(id, ib.Tag)
		DB.Where("inbound_id = ?", ib.ID).Delete(&model.XrayClient{})
	}
	DB.Where("node_id = ?", id).Delete(&model.XrayInbound{})

	// Cascade cleanup: Xray TLS certs
	DB.Where("node_id = ?", id).Delete(&model.XrayTlsCert{})

	// Cascade cleanup: user_node records
	DB.Where("node_id = ?", id).Delete(&model.UserNode{})

	DB.Delete(&node)
	return dto.Ok("节点删除成功")
}

func UpdateNodeOrder(items []dto.OrderItem) dto.R {
	for _, item := range items {
		DB.Model(&model.Node{}).Where("id = ?", item.ID).Update("inx", item.Inx)
	}
	return dto.Ok("排序更新成功")
}

func GetUserAccessibleNodes(userId int64, roleId int) dto.R {
	var nodes []model.Node
	if roleId == 0 {
		// Admin: return all nodes
		DB.Order("inx ASC, created_time DESC").Find(&nodes)
	} else {
		// Check if user has any user_node records
		var total int64
		DB.Model(&model.UserNode{}).Where("user_id = ?", userId).Count(&total)
		if total == 0 {
			// Legacy user with no records: return all nodes
			DB.Order("inx ASC, created_time DESC").Find(&nodes)
		} else {
			DB.Where("id IN (?)", DB.Model(&model.UserNode{}).Select("node_id").Where("user_id = ?", userId)).
				Order("inx ASC, created_time DESC").Find(&nodes)
		}
	}

	result := make([]map[string]interface{}, 0, len(nodes))
	for _, n := range nodes {
		status := n.Status
		if pkg.WS != nil && pkg.WS.IsNodeOnline(n.ID) {
			status = 1
		}
		item := map[string]interface{}{
			"id":       n.ID,
			"name":     n.Name,
			"entryIps": n.EntryIps,
			"status":   status,
		}
		if pkg.WS != nil {
			if info := pkg.WS.GetNodeSystemInfo(n.ID); info != nil {
				item["interfaces"] = info.Interfaces
			}
		}
		result = append(result, item)
	}
	return dto.Ok(result)
}

func GetNodeById(id int64) *model.Node {
	var node model.Node
	if err := DB.First(&node, id).Error; err != nil {
		return nil
	}
	return &node
}

func GenerateInstallCommand(id int64, clientAddr string) dto.R {
	var node model.Node
	if err := DB.First(&node, id).Error; err != nil {
		return dto.Err("节点不存在")
	}

	panelAddr := GetPanelAddress(clientAddr)

	cmd := fmt.Sprintf("curl -fsSL %s/s/%s/init | bash",
		panelAddr, node.Secret)

	return dto.Ok(cmd)
}

func GenerateDockerInstallCommand(id int64, clientAddr string) dto.R {
	var node model.Node
	if err := DB.First(&node, id).Error; err != nil {
		return dto.Err("节点不存在")
	}

	panelAddr := GetPanelAddress(clientAddr)

	imageTag := pkg.Version
	if imageTag == "" || imageTag == "dev" {
		imageTag = "latest"
	}
	cmd := fmt.Sprintf(`docker stop flux-node 2>/dev/null; docker rm flux-node 2>/dev/null; mkdir -p ~/.flux && docker run -d --name flux-node --restart unless-stopped --network host -v ~/.flux:/etc/node -e PANEL_ADDR=%s -e SECRET=%s 0xnetuser/node:%s`,
		panelAddr, node.Secret, imageTag)

	return dto.Ok(cmd)
}

// getPanelAddress returns the panel address with priority:
// 1. vite_config panel_addr (admin explicitly configured)
// 2. clientAddr from frontend (window.location.origin)
// 3. fallback to localhost
func GetPanelAddress(clientAddr string) string {
	var cfg model.ViteConfig
	if err := DB.Where("name = ?", "panel_addr").First(&cfg).Error; err == nil && cfg.Value != "" {
		addr := normalizePanelAddr(cfg.Value)
		log.Printf("[GetPanelAddress] 使用数据库配置: %s", addr)
		return addr
	}
	if clientAddr != "" {
		log.Printf("[GetPanelAddress] 数据库无 panel_addr，使用 clientAddr: %s", clientAddr)
		return clientAddr
	}
	addr := fmt.Sprintf("http://127.0.0.1:%d", config.Cfg.Port)
	log.Printf("[GetPanelAddress] fallback: %s", addr)
	return addr
}

// normalizePanelAddr ensures the panel address has a scheme (http:// or https://).
func normalizePanelAddr(addr string) string {
	if strings.HasPrefix(addr, "http://") || strings.HasPrefix(addr, "https://") {
		return addr
	}
	return "http://" + addr
}
