package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"fmt"
	"strings"
)

func AssignUserTunnel(d dto.UserTunnelDto) dto.R {
	// Check user exists
	var user model.User
	if err := DB.First(&user, d.UserId).Error; err != nil {
		return dto.Err("用户不存在")
	}

	// Check tunnel exists
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, d.TunnelId).Error; err != nil {
		return dto.Err("隧道不存在")
	}

	// Check if already assigned
	var count int64
	DB.Model(&model.UserTunnel{}).Where("user_id = ? AND tunnel_id = ?", d.UserId, d.TunnelId).Count(&count)
	if count > 0 {
		return dto.Err("该用户已有此隧道权限")
	}

	ut := model.UserTunnel{
		UserId:        d.UserId,
		TunnelId:      d.TunnelId,
		Num:           d.Num,
		Flow:          d.Flow,
		FlowResetTime: d.FlowResetTime,
		ExpTime:       d.ExpTime,
		SpeedId:       d.SpeedId,
		Status:        1,
	}

	// Create limiter on node if speed is set
	if d.SpeedId != nil && *d.SpeedId > 0 {
		var speedLimit model.SpeedLimit
		if err := DB.First(&speedLimit, *d.SpeedId).Error; err == nil {
			inNode := GetNodeById(tunnel.InNodeId)
			if inNode != nil {
				speed := fmt.Sprintf("%d", speedLimit.Speed)
				pkg.AddLimiters(inNode.ID, *d.SpeedId, speed)
			}
		}
	}

	if err := DB.Create(&ut).Error; err != nil {
		return dto.Err("分配隧道权限失败")
	}
	return dto.Ok(ut)
}

func ListUserTunnels(tunnelId *int64, userId *int64) dto.R {
	type UserTunnelDetail struct {
		model.UserTunnel
		TunnelName string `json:"tunnelName"`
		TunnelType int    `json:"tunnelType"`
		UserName   string `json:"userName"`
		SpeedName  string `json:"speedName"`
	}

	query := DB.Table("user_tunnel ut").
		Select("ut.*, t.name as tunnel_name, t.type as tunnel_type, u.user as user_name, sl.name as speed_name").
		Joins("LEFT JOIN tunnel t ON ut.tunnel_id = t.id").
		Joins("LEFT JOIN user u ON ut.user_id = u.id").
		Joins("LEFT JOIN speed_limit sl ON ut.speed_id = sl.id")

	if tunnelId != nil {
		query = query.Where("ut.tunnel_id = ?", *tunnelId)
	}
	if userId != nil {
		query = query.Where("ut.user_id = ?", *userId)
	}

	var list []UserTunnelDetail
	query.Scan(&list)
	return dto.Ok(list)
}

func RemoveUserTunnel(id int64) dto.R {
	var ut model.UserTunnel
	if err := DB.First(&ut, id).Error; err != nil {
		return dto.Err("隧道权限不存在")
	}

	// Delete all forwards for this user on this tunnel
	var forwards []model.Forward
	DB.Where("user_id = ? AND tunnel_id = ?", ut.UserId, ut.TunnelId).Find(&forwards)

	var tunnel model.Tunnel
	DB.First(&tunnel, ut.TunnelId)

	for _, fwd := range forwards {
		serviceName := fmt.Sprintf("%d_%d_%d", fwd.ID, fwd.UserId, ut.ID)

		inNode := GetNodeById(tunnel.InNodeId)
		if inNode != nil {
			if fwd.ListenIp != "" && strings.Contains(fwd.ListenIp, ",") {
				pkg.DeleteServiceMultiIP(inNode.ID, serviceName, fwd.ListenIp)
			} else {
				pkg.DeleteService(inNode.ID, serviceName)
			}
			if tunnel.Type == 2 {
				pkg.DeleteChains(inNode.ID, serviceName)
				outNode := GetNodeById(tunnel.OutNodeId)
				if outNode != nil {
					pkg.DeleteRemoteService(outNode.ID, serviceName)
				}
			}
		}
		DB.Delete(&fwd)
	}

	DB.Delete(&ut)
	return dto.Ok("隧道权限删除成功")
}

func UpdateUserTunnel(d dto.UserTunnelUpdateDto) dto.R {
	var ut model.UserTunnel
	if err := DB.First(&ut, d.ID).Error; err != nil {
		return dto.Err("隧道权限不存在")
	}

	updates := map[string]interface{}{}
	if d.Num != nil {
		updates["num"] = *d.Num
	}
	if d.Flow != nil {
		updates["flow"] = *d.Flow
	}
	if d.FlowResetTime != nil {
		updates["flow_reset_time"] = *d.FlowResetTime
	}
	if d.ExpTime != nil {
		updates["exp_time"] = *d.ExpTime
	}
	if d.Status != nil {
		updates["status"] = *d.Status
	}

	// Handle speed change
	oldSpeedId := ut.SpeedId
	if d.SpeedId != nil {
		updates["speed_id"] = *d.SpeedId

		var tunnel model.Tunnel
		if err := DB.First(&tunnel, ut.TunnelId).Error; err == nil {
			inNode := GetNodeById(tunnel.InNodeId)
			if inNode != nil {
				// If speed changed, update all forwards' limiters
				if oldSpeedId == nil || *oldSpeedId != *d.SpeedId {
					if *d.SpeedId > 0 {
						var speedLimit model.SpeedLimit
						if err := DB.First(&speedLimit, *d.SpeedId).Error; err == nil {
							speed := fmt.Sprintf("%d", speedLimit.Speed)
							pkg.AddLimiters(inNode.ID, *d.SpeedId, speed)
						}
					}

					// Update ut.SpeedId in memory BEFORE rebuilding services,
					// so updateForwardWithNewSpeed uses the NEW speed
					ut.SpeedId = d.SpeedId

					// Update all forwards for this user+tunnel to use new speed
					var forwards []model.Forward
					DB.Where("user_id = ? AND tunnel_id = ?", ut.UserId, ut.TunnelId).Find(&forwards)
					for _, fwd := range forwards {
						updateForwardWithNewSpeed(fwd, tunnel, &ut)
					}
				}
			}
		}
	}

	if len(updates) > 0 {
		DB.Model(&ut).Updates(updates)
	}

	return dto.Ok("更新成功")
}

func updateForwardWithNewSpeed(fwd model.Forward, tunnel model.Tunnel, ut *model.UserTunnel) {
	serviceName := fmt.Sprintf("%d_%d_%d", fwd.ID, fwd.UserId, ut.ID)

	inNode := GetNodeById(tunnel.InNodeId)
	if inNode == nil {
		return
	}

	var limiter *int
	if ut.SpeedId != nil {
		speedId := int(*ut.SpeedId)
		limiter = &speedId
	}

	interfaceName := ""
	if tunnel.Type != 2 {
		interfaceName = fwd.InterfaceName
	}

	// Limiter change requires service rebuild because the CachedTrafficLimiter
	// stores the limiter object reference at creation time. Updating the registry
	// alone does not propagate to running services.
	pkg.UpdateService(inNode.ID, serviceName, fwd.InPort, limiter, fwd.RemoteAddr, tunnel.Type, &tunnel, fwd.Strategy, interfaceName)
}
