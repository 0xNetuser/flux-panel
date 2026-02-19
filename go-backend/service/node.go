package service

import (
	"fmt"
	"flux-panel/go-backend/config"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"time"
)

func CreateNode(d dto.NodeDto) dto.R {
	if d.PortSta >= d.PortEnd {
		return dto.Err("起始端口必须小于结束端口")
	}

	node := model.Node{
		Name:        d.Name,
		Ip:          d.Ip,
		ServerIp:    d.ServerIp,
		PortSta:     d.PortSta,
		PortEnd:     d.PortEnd,
		Secret:      pkg.GenerateSecureSecret(),
		Status:      0,
		CreatedTime: time.Now().UnixMilli(),
		UpdatedTime: time.Now().UnixMilli(),
	}

	if err := DB.Create(&node).Error; err != nil {
		return dto.Err("创建节点失败")
	}
	return dto.Ok(node)
}

func GetAllNodes() dto.R {
	var nodes []model.Node
	DB.Order("created_time DESC").Find(&nodes)

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
			"createdTime": n.CreatedTime,
			"updatedTime": n.UpdatedTime,
			"status":      status,
		}

		// Overlay live system info from WS cache
		if pkg.WS != nil {
			if info := pkg.WS.GetNodeSystemInfo(n.ID); info != nil {
				item["cpuUsage"] = info.CPUUsage
				item["memUsage"] = info.MemoryUsage
				item["uptime"] = info.Uptime
				item["bytesReceived"] = info.BytesReceived
				item["bytesTransmitted"] = info.BytesTransmitted
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

	DB.Delete(&node)
	return dto.Ok("节点删除成功")
}

func GetUserAccessibleNodes(userId int64, roleId int) dto.R {
	var nodes []model.Node
	if roleId == 0 {
		// Admin: return all nodes
		DB.Order("created_time DESC").Find(&nodes)
	} else {
		// Check if user has any user_node records
		var total int64
		DB.Model(&model.UserNode{}).Where("user_id = ?", userId).Count(&total)
		if total == 0 {
			// Legacy user with no records: return all nodes
			DB.Order("created_time DESC").Find(&nodes)
		} else {
			DB.Where("id IN (?)", DB.Model(&model.UserNode{}).Select("node_id").Where("user_id = ?", userId)).
				Order("created_time DESC").Find(&nodes)
		}
	}

	result := make([]map[string]interface{}, 0, len(nodes))
	for _, n := range nodes {
		status := n.Status
		if pkg.WS != nil && pkg.WS.IsNodeOnline(n.ID) {
			status = 1
		}
		result = append(result, map[string]interface{}{
			"id":     n.ID,
			"name":   n.Name,
			"status": status,
		})
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

	panelAddr := getPanelAddress(clientAddr)

	cmd := fmt.Sprintf("curl -fsSL %s/node-install/script | bash -s -- %d %s %s",
		panelAddr, node.ID, node.Secret, panelAddr)

	return dto.Ok(cmd)
}

func GenerateDockerInstallCommand(id int64, clientAddr string) dto.R {
	var node model.Node
	if err := DB.First(&node, id).Error; err != nil {
		return dto.Err("节点不存在")
	}

	panelAddr := getPanelAddress(clientAddr)

	imageTag := pkg.Version
	if imageTag == "" || imageTag == "dev" {
		imageTag = "latest"
	}
	cmd := fmt.Sprintf(`mkdir -p ~/.flux && docker run -d --name gost-node --restart unless-stopped --network host -v ~/.flux:/etc/gost -e PANEL_ADDR=%s -e SECRET=%s 0xnetuser/gost-node:%s`,
		panelAddr, node.Secret, imageTag)

	return dto.Ok(cmd)
}

// getPanelAddress returns the panel address with priority:
// 1. vite_config panel_addr (admin explicitly configured)
// 2. clientAddr from frontend (window.location.origin)
// 3. fallback to localhost
func getPanelAddress(clientAddr string) string {
	var cfg model.ViteConfig
	if err := DB.Where("name = ?", "panel_addr").First(&cfg).Error; err == nil && cfg.Value != "" {
		return cfg.Value
	}
	if clientAddr != "" {
		return clientAddr
	}
	return fmt.Sprintf("http://127.0.0.1:%d", config.Cfg.Port)
}
