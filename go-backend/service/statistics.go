package service

import (
	"flux-panel/go-backend/model"
	"fmt"
	"log"
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

	log.Println("每小时流量统计完成")
}
