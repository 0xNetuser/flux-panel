package service

import (
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"time"
)

// StartXrayScheduler starts periodic tasks for Xray management.
// Called from main.go after DB is initialized.
func StartXrayScheduler() {
	go xrayClientTrafficResetLoop()
	go xrayCertRenewLoop()
}

// xrayCertRenewLoop checks once per day for certificates needing renewal.
func xrayCertRenewLoop() {
	// Initial delay
	time.Sleep(30 * time.Second)

	for {
		RenewExpiringSoon()
		time.Sleep(24 * time.Hour)
	}
}

// xrayClientTrafficResetLoop checks every hour for clients needing traffic reset.
func xrayClientTrafficResetLoop() {
	// Initial delay to let the system start up
	time.Sleep(10 * time.Second)

	for {
		checkClientTrafficReset()
		time.Sleep(1 * time.Hour)
	}
}

// checkClientTrafficReset resets traffic for clients whose reset cycle has elapsed.
// Logic: if reset > 0, calculate next reset time as createdTime + N * reset * 86400000 ms.
// If current time has passed the next reset boundary, reset traffic counters.
func checkClientTrafficReset() {
	var clients []model.XrayClient
	DB.Where("`reset` > 0").Find(&clients)

	now := time.Now().UnixMilli()
	resetCount := 0

	for _, client := range clients {
		resetMs := int64(client.Reset) * 24 * 60 * 60 * 1000
		if resetMs <= 0 {
			continue
		}

		// How many full cycles have elapsed since creation
		elapsed := now - client.CreatedTime
		if elapsed <= 0 {
			continue
		}

		cyclesPassed := elapsed / resetMs
		nextResetTime := client.CreatedTime + (cyclesPassed * resetMs)

		// Check if we should reset: the last update was before the most recent reset boundary
		if client.UpdatedTime < nextResetTime {
			DB.Model(&client).Updates(map[string]interface{}{
				"up_traffic":   0,
				"down_traffic": 0,
				"updated_time": now,
			})

			// Re-enable if it was auto-disabled due to traffic limit
			if client.Enable == 0 && client.TotalTraffic > 0 {
				DB.Model(&client).Update("enable", 1)
				var inbound model.XrayInbound
				if err := DB.First(&inbound, client.InboundId).Error; err == nil {
					pkg.XrayAddClient(inbound.NodeId, inbound.Tag, client.Email, client.UuidOrPassword, client.Flow, client.AlterId, inbound.Protocol)
				}
			}

			resetCount++
			log.Printf("[XrayScheduler] Reset traffic for client %d (email=%s, cycle=%d days)",
				client.ID, client.Email, client.Reset)
		}
	}

	if resetCount > 0 {
		log.Printf("[XrayScheduler] Traffic reset completed: %d clients reset", resetCount)
	}
}
