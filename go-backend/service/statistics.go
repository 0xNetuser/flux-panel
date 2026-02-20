package service

import (
	"flux-panel/go-backend/model"
	"fmt"
	"log"
	"strconv"
	"time"
)

func RecordHourlyStatistics() {
	var users []model.User
	DB.Where("role_id != 0").Find(&users)

	hour := fmt.Sprintf("%02d:00", time.Now().Hour())
	now := time.Now().UnixMilli()

	for _, user := range users {
		totalFlow := user.InFlow + user.OutFlow

		// Get last record to compute incremental flow
		var lastRecord model.StatisticsFlow
		err := DB.Where("user_id = ?", user.ID).Order("id DESC").First(&lastRecord).Error

		var incrementalFlow int64
		if err == nil {
			incrementalFlow = totalFlow - lastRecord.TotalFlow
			if incrementalFlow < 0 {
				incrementalFlow = 0
			}
		} else {
			incrementalFlow = totalFlow
		}

		record := model.StatisticsFlow{
			UserId:      user.ID,
			Flow:        incrementalFlow,
			TotalFlow:   totalFlow,
			Time:        hour,
			CreatedTime: now,
		}
		DB.Create(&record)
	}

	// Delete records older than 48 hours
	cutoff := now - 48*60*60*1000
	DB.Where("created_time < ?", cutoff).Delete(&model.StatisticsFlow{})

	// Record forward flow snapshots
	RecordForwardFlowSnapshots()

	// Clean old monitor data
	CleanOldMonitorData()

	log.Println("每小时流量统计完成")
}

// RecordForwardFlowSnapshots records current in_flow/out_flow for all forwards.
func RecordForwardFlowSnapshots() {
	var forwards []model.Forward
	DB.Find(&forwards)

	now := time.Now().Unix()
	for _, f := range forwards {
		record := model.StatisticsForwardFlow{
			ForwardId:  f.ID,
			InFlow:     f.InFlow,
			OutFlow:    f.OutFlow,
			RecordTime: now,
		}
		DB.Create(&record)
	}
	log.Printf("转发流量快照记录完成，共 %d 条", len(forwards))
}

// CleanOldMonitorData removes monitoring data older than the configured retention days.
func CleanOldMonitorData() {
	days := 7 // default
	var cfg model.ViteConfig
	if err := DB.Where("name = ?", "monitor_retention_days").First(&cfg).Error; err == nil {
		if v, err := strconv.Atoi(cfg.Value); err == nil && v > 0 {
			days = v
		}
	}

	cutoff := time.Now().Unix() - int64(days*86400)
	DB.Where("record_time < ?", cutoff).Delete(&model.StatisticsForwardFlow{})
	DB.Where("record_time < ?", cutoff).Delete(&model.MonitorLatency{})
	log.Printf("已清理 %d 天前的监控数据", days)
}
