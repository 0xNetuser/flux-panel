package service

import (
	"fmt"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"sort"
	"time"
)

// GetAdminDashboardStats returns aggregated stats for admin dashboard.
func GetAdminDashboardStats() dto.R {
	// Nodes — use live WS status for accurate online count
	var allNodes []model.Node
	DB.Find(&allNodes)
	totalNodes := int64(len(allNodes))
	var onlineNodes int64
	for _, n := range allNodes {
		if pkg.WS != nil && pkg.WS.IsNodeOnline(n.ID) {
			onlineNodes++
		}
	}

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

	// Node list — reuse allNodes with live WS status
	nodeList := make([]map[string]interface{}, 0, len(allNodes))
	for _, n := range allNodes {
		status := n.Status
		if pkg.WS != nil && pkg.WS.IsNodeOnline(n.ID) {
			status = 1
		}
		nodeList = append(nodeList, map[string]interface{}{
			"id":       n.ID,
			"name":     n.Name,
			"serverIp": n.ServerIp,
			"status":   status,
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

// getTrafficHistory returns 24h traffic data from statistics_forward_flow.
// Uses cumulative snapshots with delta computation (same approach as monitor page).
// If userId=0, aggregates all forwards; otherwise filters by user's forwards.
func getTrafficHistory(userId int64) []map[string]interface{} {
	cutoff := time.Now().Unix() - 25*3600 // fetch one extra hour for delta computation

	var records []model.StatisticsForwardFlow
	query := DB.Where("record_time >= ?", cutoff).Order("record_time ASC")
	if userId > 0 {
		var forwardIds []int64
		DB.Model(&model.Forward{}).Where("user_id = ?", userId).Pluck("id", &forwardIds)
		if len(forwardIds) == 0 {
			return buildEmptyTrafficHistory()
		}
		query = query.Where("forward_id IN ?", forwardIds)
	}
	query.Find(&records)

	if len(records) == 0 {
		return buildEmptyTrafficHistory()
	}

	// Group by (forwardId, bucket) → last snapshot
	bucketSize := int64(3600)
	type fwBucketKey struct {
		ForwardId int64
		Bucket    int64
	}
	fwBucketSnapshot := make(map[fwBucketKey]int64) // total flow
	for _, r := range records {
		key := fwBucketKey{r.ForwardId, (r.RecordTime / bucketSize) * bucketSize}
		fwBucketSnapshot[key] = r.InFlow + r.OutFlow
	}

	// Collect unique forward IDs and sorted buckets
	fwIds := make(map[int64]bool)
	allBuckets := make(map[int64]bool)
	for k := range fwBucketSnapshot {
		fwIds[k.ForwardId] = true
		allBuckets[k.Bucket] = true
	}

	sortedBuckets := make([]int64, 0, len(allBuckets))
	for b := range allBuckets {
		sortedBuckets = append(sortedBuckets, b)
	}
	sort.Slice(sortedBuckets, func(i, j int) bool { return sortedBuckets[i] < sortedBuckets[j] })

	// Compute deltas per bucket
	actualCutoff := time.Now().Unix() - 24*3600
	bucketFlow := make(map[int64]int64) // bucket → total delta flow
	for fwId := range fwIds {
		var prev int64
		firstSeen := false
		for _, bt := range sortedBuckets {
			snap, ok := fwBucketSnapshot[fwBucketKey{fwId, bt}]
			if !ok {
				continue
			}
			if !firstSeen {
				prev = snap
				firstSeen = true
				continue
			}
			if bt < actualCutoff {
				prev = snap
				continue
			}
			delta := snap - prev
			if delta < 0 {
				delta = 0
			}
			bucketFlow[bt] += delta
			prev = snap
		}
	}

	// Build 24-hour result
	result := make([]map[string]interface{}, 0, 24)
	nowTs := time.Now().Unix()
	for i := 23; i >= 0; i-- {
		bt := ((nowTs - int64(i)*3600) / bucketSize) * bucketSize
		t := time.Unix(bt, 0)
		timeStr := fmt.Sprintf("%02d:00", t.Hour())
		result = append(result, map[string]interface{}{
			"time": timeStr,
			"flow": bucketFlow[bt],
		})
	}

	return result
}

func buildEmptyTrafficHistory() []map[string]interface{} {
	result := make([]map[string]interface{}, 0, 24)
	now := time.Now().Hour()
	for i := 23; i >= 0; i-- {
		h := (now - i + 24) % 24
		result = append(result, map[string]interface{}{
			"time": fmt.Sprintf("%02d:00", h),
			"flow": int64(0),
		})
	}
	return result
}
