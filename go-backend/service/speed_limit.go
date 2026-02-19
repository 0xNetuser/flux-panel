package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"fmt"
	"time"
)

func CreateSpeedLimit(d dto.SpeedLimitDto) dto.R {
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, d.TunnelId).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	sl := model.SpeedLimit{
		Name:        d.Name,
		Speed:       d.Speed,
		TunnelId:    d.TunnelId,
		TunnelName:  tunnel.Name,
		Status:      1,
		CreatedTime: time.Now().UnixMilli(),
		UpdatedTime: time.Now().UnixMilli(),
	}

	if err := DB.Create(&sl).Error; err != nil {
		return dto.Err("创建限速失败")
	}

	// Add limiter on node
	inNode := GetNodeById(tunnel.InNodeId)
	if inNode != nil {
		speed := fmt.Sprintf("%d", sl.Speed)
		pkg.AddLimiters(inNode.ID, sl.ID, speed)
	}

	return dto.Ok(sl)
}

func GetAllSpeedLimits() dto.R {
	var list []model.SpeedLimit
	DB.Order("created_time DESC").Find(&list)
	return dto.Ok(list)
}

func UpdateSpeedLimit(d dto.SpeedLimitUpdateDto) dto.R {
	var sl model.SpeedLimit
	if err := DB.First(&sl, d.ID).Error; err != nil {
		return dto.Err("限速不存在")
	}

	if d.Name != "" {
		sl.Name = d.Name
	}
	if d.Speed != nil {
		sl.Speed = *d.Speed
	}
	sl.UpdatedTime = time.Now().UnixMilli()

	DB.Save(&sl)

	// Update limiter on node
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, sl.TunnelId).Error; err == nil {
		inNode := GetNodeById(tunnel.InNodeId)
		if inNode != nil {
			speed := fmt.Sprintf("%d", sl.Speed)
			pkg.UpdateLimiters(inNode.ID, sl.ID, speed)
		}
	}

	return dto.Ok("更新成功")
}

func DeleteSpeedLimit(id int64) dto.R {
	var sl model.SpeedLimit
	if err := DB.First(&sl, id).Error; err != nil {
		return dto.Err("限速不存在")
	}

	// Check if used by any user_tunnel
	var count int64
	DB.Model(&model.UserTunnel{}).Where("speed_id = ?", id).Count(&count)
	if count > 0 {
		return dto.Err("该限速正在被使用，无法删除")
	}

	// Delete limiter on node
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, sl.TunnelId).Error; err == nil {
		inNode := GetNodeById(tunnel.InNodeId)
		if inNode != nil {
			pkg.DeleteLimiters(inNode.ID, sl.ID)
		}
	}

	DB.Delete(&sl)
	return dto.Ok("删除成功")
}

func GetSpeedLimitsByTunnel(tunnelId int64) dto.R {
	var list []model.SpeedLimit
	DB.Where("tunnel_id = ?", tunnelId).Find(&list)
	return dto.Ok(list)
}
