package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"time"
)

func CreateTunnel(d dto.TunnelDto) dto.R {
	// Check name uniqueness
	var count int64
	DB.Model(&model.Tunnel{}).Where("name = ?", d.Name).Count(&count)
	if count > 0 {
		return dto.Err("隧道名称已存在")
	}

	// Get in node
	inNode := GetNodeById(d.InNodeId)
	if inNode == nil {
		return dto.Err("入口节点不存在")
	}

	outNodeId := d.InNodeId
	outIp := inNode.ServerIp
	if d.Type == 2 {
		if d.OutNodeId == nil {
			return dto.Err("隧道转发必须指定出口节点")
		}
		outNodeId = *d.OutNodeId
		outNode := GetNodeById(outNodeId)
		if outNode == nil {
			return dto.Err("出口节点不存在")
		}
		outIp = outNode.ServerIp
	}

	trafficRatio := 1.0
	if d.TrafficRatio != nil {
		trafficRatio = *d.TrafficRatio
	}

	protocol := "tls"
	if d.Protocol != "" {
		protocol = d.Protocol
	}

	tcpListenAddr := "0.0.0.0"
	if d.TcpListenAddr != "" {
		tcpListenAddr = d.TcpListenAddr
	}
	udpListenAddr := "0.0.0.0"
	if d.UdpListenAddr != "" {
		udpListenAddr = d.UdpListenAddr
	}

	tunnel := model.Tunnel{
		Name:          d.Name,
		InNodeId:      d.InNodeId,
		InIp:          inNode.ServerIp,
		OutNodeId:     outNodeId,
		OutIp:         outIp,
		Type:          d.Type,
		Flow:          d.Flow,
		TrafficRatio:  trafficRatio,
		Protocol:      protocol,
		TcpListenAddr: tcpListenAddr,
		UdpListenAddr: udpListenAddr,
		InterfaceName: d.InterfaceName,
		Status:        1,
		CreatedTime:   time.Now().UnixMilli(),
		UpdatedTime:   time.Now().UnixMilli(),
	}

	if err := DB.Create(&tunnel).Error; err != nil {
		return dto.Err("创建隧道失败")
	}
	return dto.Ok(tunnel)
}

func GetAllTunnels() dto.R {
	var tunnels []model.Tunnel
	DB.Order("created_time DESC").Find(&tunnels)
	return dto.Ok(tunnels)
}

func UpdateTunnel(d dto.TunnelUpdateDto) dto.R {
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, d.ID).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	// Check name uniqueness excluding self
	var count int64
	DB.Model(&model.Tunnel{}).Where("name = ? AND id != ?", d.Name, d.ID).Count(&count)
	if count > 0 {
		return dto.Err("隧道名称已存在")
	}

	updates := map[string]interface{}{
		"name":            d.Name,
		"flow":            d.Flow,
		"protocol":        d.Protocol,
		"tcp_listen_addr": d.TcpListenAddr,
		"udp_listen_addr": d.UdpListenAddr,
		"interface_name":  d.InterfaceName,
		"updated_time":    time.Now().UnixMilli(),
	}
	if d.TrafficRatio != nil {
		updates["traffic_ratio"] = *d.TrafficRatio
	}

	if err := DB.Model(&tunnel).Updates(updates).Error; err != nil {
		return dto.Err("更新隧道失败")
	}
	return dto.Ok("隧道更新成功")
}

func DeleteTunnel(id int64) dto.R {
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, id).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	// Check if tunnel has forwards
	var fwdCount int64
	DB.Model(&model.Forward{}).Where("tunnel_id = ?", id).Count(&fwdCount)
	if fwdCount > 0 {
		return dto.Err("该隧道下还有转发规则，请先删除转发")
	}

	// Delete user_tunnel records
	DB.Where("tunnel_id = ?", id).Delete(&model.UserTunnel{})

	DB.Delete(&tunnel)
	return dto.Ok("隧道删除成功")
}

func DiagnoseTunnel(id int64) dto.R {
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, id).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	inNode := GetNodeById(tunnel.InNodeId)
	if inNode == nil {
		return dto.Err("入口节点不存在")
	}

	if tunnel.Type == 2 {
		outNode := GetNodeById(tunnel.OutNodeId)
		if outNode == nil {
			return dto.Err("出口节点不存在")
		}
		// TCP ping from inNode to outNode
		result := TcpPingNode(inNode.ID, outNode.ServerIp, 0)
		return dto.Ok(result)
	}

	return dto.Ok("端口转发隧道无需诊断")
}

func GetUserAccessibleTunnels(userId int64, roleId int) dto.R {
	if roleId == 0 {
		return GetAllTunnels()
	}

	// Get tunnels user has permission for
	type TunnelWithPermission struct {
		model.Tunnel
		UserTunnelId int64 `json:"userTunnelId"`
	}

	// Check if user has node restrictions
	var nodeCount int64
	DB.Model(&model.UserNode{}).Where("user_id = ?", userId).Count(&nodeCount)

	var tunnels []TunnelWithPermission
	if nodeCount > 0 {
		// User has node restrictions: filter tunnels by allowed nodes
		DB.Raw(`SELECT t.*, ut.id as user_tunnel_id FROM tunnel t
			INNER JOIN user_tunnel ut ON t.id = ut.tunnel_id
			WHERE ut.user_id = ? AND ut.status = 1
			AND t.in_node_id IN (SELECT node_id FROM user_node WHERE user_id = ?)`, userId, userId).Scan(&tunnels)
	} else {
		// No node restrictions: show all permitted tunnels
		DB.Raw(`SELECT t.*, ut.id as user_tunnel_id FROM tunnel t
			INNER JOIN user_tunnel ut ON t.id = ut.tunnel_id
			WHERE ut.user_id = ? AND ut.status = 1`, userId).Scan(&tunnels)
	}

	return dto.Ok(tunnels)
}

func TcpPingNode(nodeId int64, ip string, port int) interface{} {
	data := map[string]interface{}{
		"ip":      ip,
		"port":    port,
		"count":   2,
		"timeout": 3000,
	}
	result := pkg.WS.SendMsg(nodeId, data, "TcpPing")
	return result
}
