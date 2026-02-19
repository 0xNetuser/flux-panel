package service

import (
	"fmt"
	"flux-panel/go-backend/config"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"strings"
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

	// Update online status from WS manager; strip secrets from response
	for i := range nodes {
		if pkg.WS != nil && pkg.WS.IsNodeOnline(nodes[i].ID) {
			nodes[i].Status = 1
		}
		nodes[i].Secret = ""
	}

	return dto.Ok(nodes)
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

func GetNodeById(id int64) *model.Node {
	var node model.Node
	if err := DB.First(&node, id).Error; err != nil {
		return nil
	}
	return &node
}

func GenerateInstallCommand(id int64) dto.R {
	var node model.Node
	if err := DB.First(&node, id).Error; err != nil {
		return dto.Err("节点不存在")
	}

	// Get panel address from vite_config
	panelAddr := getPanelAddress()

	cmd := fmt.Sprintf("curl -fsSL %s/node-install/script | bash -s -- %d %s %s",
		panelAddr, node.ID, node.Secret, panelAddr)

	return dto.Ok(cmd)
}

func GenerateDockerInstallCommand(id int64) dto.R {
	var node model.Node
	if err := DB.First(&node, id).Error; err != nil {
		return dto.Err("节点不存在")
	}

	panelAddr := getPanelAddress()
	wsAddr := strings.Replace(strings.Replace(panelAddr, "https://", "wss://", 1), "http://", "ws://", 1)

	cmd := fmt.Sprintf(`docker run -d --name gost-node --restart unless-stopped --network host -e NODE_ID=%d -e NODE_SECRET=%s -e WS_ADDR=%s/system-info -e FLOW_ADDR=%s 0xnetuser/gost-node:latest`,
		node.ID, node.Secret, wsAddr, panelAddr)

	return dto.Ok(cmd)
}

func getPanelAddress() string {
	var cfg model.ViteConfig
	if err := DB.Where("name = ?", "panel_address").First(&cfg).Error; err == nil && cfg.Value != "" {
		return cfg.Value
	}
	return fmt.Sprintf("http://127.0.0.1:%d", config.Cfg.Port)
}
