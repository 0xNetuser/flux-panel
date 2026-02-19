package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"time"
)

// ---------------------------------------------------------------------------
// Xray permission helpers
// ---------------------------------------------------------------------------

func checkXrayPermission(userId int64, roleId int) *dto.R {
	if roleId == 0 {
		return nil // admin
	}
	var user model.User
	if err := DB.First(&user, userId).Error; err != nil {
		r := dto.Err("用户不存在")
		return &r
	}
	if user.XrayEnabled != 1 {
		r := dto.Err("无 Xray 权限")
		return &r
	}
	return nil
}

func checkXrayNodeAccess(userId int64, roleId int, nodeId int64) *dto.R {
	if roleId == 0 {
		return nil
	}
	if !UserHasNodeAccess(userId, nodeId) {
		r := dto.Err("无该节点的访问权限")
		return &r
	}
	return nil
}

func getUserAccessibleNodeIds(userId int64) []int64 {
	var total int64
	DB.Model(&model.UserNode{}).Where("user_id = ?", userId).Count(&total)
	if total == 0 {
		// Legacy user: return all node IDs
		var ids []int64
		DB.Model(&model.Node{}).Pluck("id", &ids)
		return ids
	}
	var ids []int64
	DB.Model(&model.UserNode{}).Where("user_id = ?", userId).Pluck("node_id", &ids)
	return ids
}

// ---------------------------------------------------------------------------
// Xray Inbound CRUD
// ---------------------------------------------------------------------------

func CreateXrayInbound(d dto.XrayInboundDto, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}
	if r := checkXrayNodeAccess(userId, roleId, d.NodeId); r != nil {
		return *r
	}

	node := GetNodeById(d.NodeId)
	if node == nil {
		return dto.Err("节点不存在")
	}

	// Check port conflict
	var portCount int64
	DB.Model(&model.XrayInbound{}).Where("node_id = ? AND port = ?", d.NodeId, d.Port).Count(&portCount)
	if portCount > 0 {
		return dto.Err("该节点端口已被其他入站使用")
	}

	// Check tag uniqueness
	var tagCount int64
	DB.Model(&model.XrayInbound{}).Where("node_id = ? AND tag = ?", d.NodeId, d.Tag).Count(&tagCount)
	if tagCount > 0 {
		return dto.Err("该节点标签已存在")
	}

	listen := "0.0.0.0"
	if d.Listen != "" {
		listen = d.Listen
	}

	inbound := model.XrayInbound{
		NodeId:             d.NodeId,
		Tag:                d.Tag,
		Protocol:           d.Protocol,
		Listen:             listen,
		Port:               d.Port,
		SettingsJson:       d.SettingsJson,
		StreamSettingsJson: d.StreamSettingsJson,
		SniffingJson:       d.SniffingJson,
		Remark:             d.Remark,
		Enable:             1,
		CreatedTime:        time.Now().UnixMilli(),
		UpdatedTime:        time.Now().UnixMilli(),
	}

	if err := DB.Create(&inbound).Error; err != nil {
		return dto.Err("创建入站失败")
	}

	result := pkg.XrayAddInbound(node.ID, &inbound)
	if result != nil && result.Msg != "OK" {
		log.Printf("下发 XrayAddInbound 到节点 %d 失败: %s", node.ID, result.Msg)
	}

	return dto.Ok(inbound)
}

func ListXrayInbounds(nodeId *int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	query := DB.Model(&model.XrayInbound{}).Order("created_time DESC")
	if nodeId != nil {
		if r := checkXrayNodeAccess(userId, roleId, *nodeId); r != nil {
			return *r
		}
		query = query.Where("node_id = ?", *nodeId)
	} else if roleId != 0 {
		// Non-admin without nodeId filter: restrict to accessible nodes
		nodeIds := getUserAccessibleNodeIds(userId)
		query = query.Where("node_id IN ?", nodeIds)
	}

	var list []model.XrayInbound
	query.Find(&list)
	return dto.Ok(list)
}

func UpdateXrayInbound(d dto.XrayInboundUpdateDto, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var existing model.XrayInbound
	if err := DB.First(&existing, d.ID).Error; err != nil {
		return dto.Err("入站不存在")
	}

	if r := checkXrayNodeAccess(userId, roleId, existing.NodeId); r != nil {
		return *r
	}

	// Port conflict check
	if d.Port != nil && *d.Port != existing.Port {
		var portCount int64
		DB.Model(&model.XrayInbound{}).Where("node_id = ? AND port = ? AND id != ?", existing.NodeId, *d.Port, d.ID).Count(&portCount)
		if portCount > 0 {
			return dto.Err("该节点端口已被其他入站使用")
		}
	}

	updates := map[string]interface{}{"updated_time": time.Now().UnixMilli()}
	if d.Tag != "" {
		updates["tag"] = d.Tag
	}
	if d.Protocol != "" {
		updates["protocol"] = d.Protocol
	}
	if d.Listen != "" {
		updates["listen"] = d.Listen
	}
	if d.Port != nil {
		updates["port"] = *d.Port
	}
	if d.SettingsJson != "" {
		updates["settings_json"] = d.SettingsJson
	}
	if d.StreamSettingsJson != "" {
		updates["stream_settings_json"] = d.StreamSettingsJson
	}
	if d.SniffingJson != "" {
		updates["sniffing_json"] = d.SniffingJson
	}
	if d.Remark != "" {
		updates["remark"] = d.Remark
	}

	DB.Model(&existing).Updates(updates)

	// Sync config to node
	syncXrayNodeConfig(existing.NodeId)

	return dto.Ok("更新成功")
}

func DeleteXrayInbound(id int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var inbound model.XrayInbound
	if err := DB.First(&inbound, id).Error; err != nil {
		return dto.Err("入站不存在")
	}

	if r := checkXrayNodeAccess(userId, roleId, inbound.NodeId); r != nil {
		return *r
	}

	// Delete associated clients
	DB.Where("inbound_id = ?", id).Delete(&model.XrayClient{})

	DB.Delete(&inbound)

	// Use full sync instead of single remove — XrayRemoveInbound is a no-op on node side
	syncXrayNodeConfig(inbound.NodeId)

	return dto.Ok("删除成功")
}

func EnableXrayInbound(id int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var inbound model.XrayInbound
	if err := DB.First(&inbound, id).Error; err != nil {
		return dto.Err("入站不存在")
	}

	if r := checkXrayNodeAccess(userId, roleId, inbound.NodeId); r != nil {
		return *r
	}

	DB.Model(&inbound).Updates(map[string]interface{}{
		"enable":       1,
		"updated_time": time.Now().UnixMilli(),
	})
	syncXrayNodeConfig(inbound.NodeId)
	return dto.Ok("已启用")
}

func DisableXrayInbound(id int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var inbound model.XrayInbound
	if err := DB.First(&inbound, id).Error; err != nil {
		return dto.Err("入站不存在")
	}

	if r := checkXrayNodeAccess(userId, roleId, inbound.NodeId); r != nil {
		return *r
	}

	DB.Model(&inbound).Updates(map[string]interface{}{
		"enable":       0,
		"updated_time": time.Now().UnixMilli(),
	})
	syncXrayNodeConfig(inbound.NodeId)
	return dto.Ok("已禁用")
}

func syncXrayNodeConfig(nodeId int64) {
	var inbounds []model.XrayInbound
	DB.Where("node_id = ? AND enable = 1", nodeId).Find(&inbounds)
	result := pkg.XrayApplyConfig(nodeId, inbounds)
	if result != nil && result.Msg != "OK" {
		log.Printf("全量同步 Xray 配置到节点 %d 失败: %s", nodeId, result.Msg)
	}
}
