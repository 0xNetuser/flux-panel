package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"

	"flux-panel/go-backend/config"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"flux-panel/go-backend/router"
	"flux-panel/go-backend/service"
	"flux-panel/go-backend/task"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	// Load config
	config.Load()

	// Connect database
	db, err := gorm.Open(mysql.Open(config.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	// Auto-migrate tables
	db.AutoMigrate(
		&model.User{},
		&model.Node{},
		&model.Tunnel{},
		&model.Forward{},
		&model.UserTunnel{},
		&model.SpeedLimit{},
		&model.StatisticsFlow{},
		&model.ViteConfig{},
		&model.XrayInbound{},
		&model.XrayClient{},
		&model.XrayTlsCert{},
		&model.UserNode{},
	)

	// Backfill NULL permission columns for existing users
	db.Exec("UPDATE `user` SET gost_enabled = 1 WHERE gost_enabled IS NULL")
	db.Exec("UPDATE `user` SET xray_enabled = 1 WHERE xray_enabled IS NULL")

	// Set global DB
	service.DB = db

	// ── Security startup checks ──
	if config.Cfg.JWTSecret == "" {
		config.Cfg.JWTSecret = generateRandomPassword(64)
		log.Println("========================================")
		log.Println("WARNING ⚠️  JWT_SECRET 未设置，已自动生成随机密钥")
		log.Println("WARNING ⚠️  重启后所有已登录用户需要重新登录")
		log.Println("WARNING ⚠️  请设置 JWT_SECRET 环境变量以持久化密钥")
		log.Println("========================================")
	}

	ensureAdminUser(db)

	// Init WebSocket manager
	pkg.InitWSManager()

	// Wire up WS callbacks
	// ValidateNodeSecret verifies a node's secret against the DB.
	// If nodeId > 0, validates that specific node; if 0, looks up by secret.
	// Returns the resolved nodeId (0 = rejected).
	pkg.WS.ValidateNodeSecret = func(nodeId int64, secret string) int64 {
		var node model.Node
		if nodeId > 0 {
			if err := db.First(&node, nodeId).Error; err != nil {
				return 0
			}
			if node.Secret != secret {
				return 0
			}
			return node.ID
		}
		// No id provided — look up by secret
		if err := db.Where("secret = ?", secret).First(&node).Error; err != nil {
			return 0
		}
		return node.ID
	}

	pkg.WS.OnNodeOnline = func(nodeId int64, version, http, tls, socks string) {
		updates := map[string]interface{}{
			"status": 1,
		}
		if version != "" {
			updates["version"] = version
		}
		if http != "" {
			updates["http"] = http
		}
		if tls != "" {
			updates["tls"] = tls
		}
		if socks != "" {
			updates["socks"] = socks
		}
		db.Model(&model.Node{}).Where("id = ?", nodeId).Updates(updates)
		log.Printf("Node %d online (version=%s)", nodeId, version)

		// Run config check on node connect
		task.RunConfigCheck(nodeId)
	}

	pkg.WS.OnNodeOffline = func(nodeId int64) {
		db.Model(&model.Node{}).Where("id = ?", nodeId).Updates(map[string]interface{}{
			"status":      0,
			"xray_status": 0,
		})
		log.Printf("Node %d offline", nodeId)
	}

	// Start scheduled tasks
	task.StartResetFlowTask(db)
	task.StartStatisticsTask()
	service.StartXrayScheduler()

	// Setup Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())

	router.Setup(r)

	addr := fmt.Sprintf(":%d", config.Cfg.Port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// ensureAdminUser creates the admin user if it doesn't exist,
// or resets the password if it's still the default value.
func ensureAdminUser(db *gorm.DB) {
	var admin model.User
	err := db.Where("user = ? AND role_id = 0", "admin_user").First(&admin).Error

	if err != nil {
		// Admin user doesn't exist — create with random password
		newPassword := generateRandomPassword(12)
		newHash := pkg.HashPassword(newPassword)
		if newHash == "" {
			log.Println("WARNING: Failed to generate bcrypt hash for admin password")
			return
		}
		now := int64(0) // will be set by service layer conventions
		admin = model.User{
			User:          "admin_user",
			Pwd:           newHash,
			RoleId:        0,
			ExpTime:       2727251700000,
			Flow:          99999,
			Num:           99999,
			FlowResetTime: 1,
			Status:        1,
			CreatedTime:   now,
			UpdatedTime:   now,
		}
		if createErr := db.Create(&admin).Error; createErr != nil {
			log.Printf("WARNING: Failed to create admin user: %v", createErr)
			return
		}
		log.Println("========================================")
		log.Printf("⚠️  管理员账号已自动创建，新密码: %s", newPassword)
		log.Println("⚠️  请立即登录并修改密码！")
		log.Println("========================================")
		return
	}

	// Admin exists — check if password is still the default "admin_user" (MD5 or bcrypt)
	if !pkg.CheckPassword("admin_user", admin.Pwd) {
		return // Password already changed
	}

	// Reset default password
	newPassword := generateRandomPassword(12)
	newHash := pkg.HashPassword(newPassword)
	if newHash == "" {
		log.Println("WARNING: Failed to generate bcrypt hash for new admin password")
		return
	}

	if updateErr := db.Model(&model.User{}).Where("id = ?", admin.ID).Update("pwd", newHash).Error; updateErr != nil {
		log.Printf("WARNING: Failed to update default admin password: %v", updateErr)
		return
	}

	log.Println("========================================")
	log.Printf("⚠️  默认管理员密码已自动重置，新密码: %s", newPassword)
	log.Println("⚠️  请立即登录并修改密码！")
	log.Println("========================================")
}

func generateRandomPassword(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)[:length]
}
