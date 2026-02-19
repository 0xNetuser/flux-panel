package service

import (
	"fmt"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"time"
)

// GetAdminDashboardStats returns aggregated stats for admin dashboard.
func GetAdminDashboardStats() dto.R {
	// Nodes
	var totalNodes, onlineNodes int64
	DB.Model(&model.Node{}).Count(&totalNodes)
	DB.Model(&model.Node{}).Where("status = 1").Count(&onlineNodes)

	// Users (non-admin)
	var totalUsers int64
	DB.Model(&model.User{}).Where("role_id != 0").Count(&totalUsers)

	// Forwards
	var totalForwards, activeForwards int64
	DB.Model(&model.Forward{}).Count(&totalForwards)
	DB.Model(&model.Forward{}).Where("status = 1").Count(&activeForwards)

	// Today's traffic (sum of all users' in_flow + out_flow)
	var todayTraffic struct{ Total int64 }
	DB.Model(&model.User{}).Select("COALESCE(SUM(in_flow + out_flow), 0) as total").Scan(&todayTraffic)

	// Traffic history: last 24 hours from statistics_flow (aggregated across all users)
	trafficHistory := getTrafficHistory(0)

	// Top 5 users by traffic
	type TopUser struct {
		Name string `json:"name" gorm:"column:user"`
		Flow int64  `json:"flow"`
	}
	var topUsers []TopUser
	DB.Model(&model.User{}).
		Select("`user`, (in_flow + out_flow) as flow").
		Where("role_id != 0").
		Order("flow DESC").
		Limit(5).
		Find(&topUsers)

	// Node list
	var nodes []model.Node
	DB.Find(&nodes)
	nodeList := make([]map[string]interface{}, 0, len(nodes))
	for _, n := range nodes {
		nodeList = append(nodeList, map[string]interface{}{
			"id":       n.ID,
			"name":     n.Name,
			"serverIp": n.ServerIp,
			"status":   n.Status,
			"version":  n.Version,
		})
	}

	return dto.Ok(map[string]interface{}{
		"nodes":          map[string]int64{"total": totalNodes, "online": onlineNodes},
		"users":          map[string]int64{"total": totalUsers},
		"forwards":       map[string]int64{"total": totalForwards, "active": activeForwards},
		"todayTraffic":   todayTraffic.Total,
		"trafficHistory": trafficHistory,
		"topUsers":       topUsers,
		"nodeList":       nodeList,
	})
}

// GetUserDashboardStats returns stats for a regular user.
func GetUserDashboardStats(userId int64) dto.R {
	// User package info
	var user model.User
	if err := DB.First(&user, userId).Error; err != nil {
		return dto.Err("用户不存在")
	}

	packageInfo := map[string]interface{}{
		"flow":          user.Flow,
		"inFlow":        user.InFlow,
		"outFlow":       user.OutFlow,
		"num":           user.Num,
		"expTime":       user.ExpTime,
		"flowResetTime": user.FlowResetTime,
	}

	// Forward count
	var forwardCount int64
	DB.Model(&model.Forward{}).Where("user_id = ?", userId).Count(&forwardCount)

	// Traffic history for this user
	trafficHistory := getTrafficHistory(userId)

	return dto.Ok(map[string]interface{}{
		"package":        packageInfo,
		"forwards":       forwardCount,
		"trafficHistory": trafficHistory,
	})
}

// getTrafficHistory returns 24h traffic data. If userId=0, aggregates all users.
func getTrafficHistory(userId int64) []map[string]interface{} {
	var flows []struct {
		Time string `gorm:"column:time"`
		Flow int64  `gorm:"column:flow"`
	}

	query := DB.Model(&model.StatisticsFlow{}).
		Select("time, SUM(flow) as flow").
		Group("time").
		Order("id DESC").
		Limit(24)

	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	query.Find(&flows)

	// Build result with 24 hours, padding missing hours with 0
	hourMap := make(map[string]int64)
	for _, f := range flows {
		hourMap[f.Time] = f.Flow
	}

	result := make([]map[string]interface{}, 0, 24)
	now := time.Now().Hour()
	for i := 23; i >= 0; i-- {
		h := (now - i + 24) % 24
		timeStr := fmt.Sprintf("%02d:00", h)
		flow := hourMap[timeStr]
		result = append(result, map[string]interface{}{
			"time": timeStr,
			"flow": flow,
		})
	}

	return result
}
