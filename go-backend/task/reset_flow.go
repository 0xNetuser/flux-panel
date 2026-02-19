package task

import (
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

func StartResetFlowTask(db *gorm.DB) {
	go func() {
		for {
			now := time.Now()
			// Schedule next run at 00:00:05
			next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 5, 0, now.Location())
			time.Sleep(time.Until(next))

			log.Println("[ResetFlowTask] Starting daily flow reset...")
			resetFlow(db)
		}
	}()
}

func resetFlow(db *gorm.DB) {
	today := time.Now()
	todayStr := today.Format("2006-01-02")
	todayStart, _ := time.ParseInLocation("2006-01-02", todayStr, today.Location())
	todayMs := todayStart.UnixMilli()
	tomorrowMs := todayStart.Add(24 * time.Hour).UnixMilli()

	// 1. Reset user flow where flowResetTime matches today
	var usersToReset []model.User
	db.Where("flow_reset_time >= ? AND flow_reset_time < ? AND status = 1", todayMs, tomorrowMs).
		Find(&usersToReset)

	for _, user := range usersToReset {
		db.Model(&model.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
			"in_flow":  0,
			"out_flow": 0,
		})
		log.Printf("[ResetFlowTask] Reset user flow: userId=%d, user=%s", user.ID, user.User)
	}

	// 2. Reset user_tunnel flow where flowResetTime matches today
	var tunnelsToReset []model.UserTunnel
	db.Where("flow_reset_time >= ? AND flow_reset_time < ? AND status = 1", todayMs, tomorrowMs).
		Find(&tunnelsToReset)

	for _, ut := range tunnelsToReset {
		db.Model(&model.UserTunnel{}).Where("id = ?", ut.ID).Updates(map[string]interface{}{
			"in_flow":  0,
			"out_flow": 0,
		})
		log.Printf("[ResetFlowTask] Reset user_tunnel flow: id=%d, userId=%d, tunnelId=%d", ut.ID, ut.UserId, ut.TunnelId)
	}

	// 3. Check expired users - pause their forwards and disable account
	nowMs := time.Now().UnixMilli()
	var expiredUsers []model.User
	db.Where("exp_time > 0 AND exp_time <= ? AND status = 1", nowMs).Find(&expiredUsers)

	for _, user := range expiredUsers {
		pauseUserForwards(db, user.ID)
		db.Model(&model.User{}).Where("id = ?", user.ID).Update("status", 0)
		log.Printf("[ResetFlowTask] Disabled expired user: userId=%d, user=%s", user.ID, user.User)
	}

	// 4. Check expired user_tunnels - pause their forwards and disable permission
	var expiredUTs []model.UserTunnel
	db.Where("exp_time > 0 AND exp_time <= ? AND status = 1", nowMs).Find(&expiredUTs)

	for _, ut := range expiredUTs {
		pauseUserTunnelForwards(db, ut.UserId, ut.TunnelId)
		db.Model(&model.UserTunnel{}).Where("id = ?", ut.ID).Update("status", 0)
		log.Printf("[ResetFlowTask] Disabled expired user_tunnel: id=%d, userId=%d, tunnelId=%d", ut.ID, ut.UserId, ut.TunnelId)
	}

	log.Println("[ResetFlowTask] Daily flow reset completed")
}

func pauseUserForwards(db *gorm.DB, userId int64) {
	var forwards []model.Forward
	db.Where("user_id = ? AND status = 1", userId).Find(&forwards)

	for _, fwd := range forwards {
		pauseSingleForward(db, &fwd)
	}
}

func pauseUserTunnelForwards(db *gorm.DB, userId int64, tunnelId int64) {
	var forwards []model.Forward
	db.Where("user_id = ? AND tunnel_id = ? AND status = 1", userId, tunnelId).Find(&forwards)

	for _, fwd := range forwards {
		pauseSingleForward(db, &fwd)
	}
}

func pauseSingleForward(db *gorm.DB, fwd *model.Forward) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[ResetFlowTask] Failed to pause forward %d: %v", fwd.ID, r)
		}
	}()

	var tunnel model.Tunnel
	if err := db.First(&tunnel, fwd.TunnelId).Error; err != nil {
		return
	}

	var inNode model.Node
	if err := db.First(&inNode, tunnel.InNodeId).Error; err != nil {
		return
	}

	var ut model.UserTunnel
	db.Where("user_id = ? AND tunnel_id = ?", fwd.UserId, tunnel.ID).First(&ut)

	serviceName := fmt.Sprintf("%d_%d_%d", fwd.ID, fwd.UserId, ut.ID)

	pkg.PauseService(inNode.ID, serviceName)
	if tunnel.Type == 2 {
		var outNode model.Node
		if err := db.First(&outNode, tunnel.OutNodeId).Error; err == nil {
			pkg.PauseRemoteService(outNode.ID, serviceName)
		}
	}

	db.Model(&model.Forward{}).Where("id = ?", fwd.ID).Update("status", 0)
}
