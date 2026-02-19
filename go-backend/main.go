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
	)

	// Set global DB
	service.DB = db

	// ── Security startup checks ──
	if config.Cfg.JWTSecret == "default_jwt_secret" {
		config.Cfg.JWTSecret = generateRandomPassword(64)
		log.Println("========================================")
		log.Println("WARNING ⚠️  JWT_SECRET 未设置，已自动生成随机密钥")
		log.Println("WARNING ⚠️  重启后所有已登录用户需要重新登录")
		log.Println("WARNING ⚠️  请设置 JWT_SECRET 环境变量以持久化密钥")
		log.Println("========================================")
	}

	checkAndResetDefaultAdmin(db)

	// Init WebSocket manager
	pkg.InitWSManager()

	// Wire up WS callbacks
	pkg.WS.OnNodeOnline = func(nodeId int64, version, http, tls, socks string) {
		updates := map[string]interface{}{
			"status": 1,
		}
		if version != "" {
			updates["version"] = version
		}
		if http != "" {
			updates["http_port"] = http
		}
		if tls != "" {
			updates["tls_port"] = tls
		}
		if socks != "" {
			updates["socks_port"] = socks
		}
		db.Model(&model.Node{}).Where("id = ?", nodeId).Updates(updates)
		log.Printf("Node %d online (version=%s)", nodeId, version)

		// Run config check on node connect
		task.RunConfigCheck(nodeId)
	}

	pkg.WS.OnNodeOffline = func(nodeId int64) {
		db.Model(&model.Node{}).Where("id = ?", nodeId).Update("status", 0)
		log.Printf("Node %d offline", nodeId)
	}

	// Start scheduled tasks
	task.StartResetFlowTask(db)
	task.StartStatisticsTask()

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

// checkAndResetDefaultAdmin checks if the admin user still has the default password.
// If so, it generates a random password, updates the DB, and prints the new password.
func checkAndResetDefaultAdmin(db *gorm.DB) {
	var admin model.User
	if err := db.Where("user = ? AND role_id = 0", "admin_user").First(&admin).Error; err != nil {
		return // Admin not found or renamed — nothing to do
	}

	// Check if password is still the default "admin_user" (MD5 or bcrypt)
	if !pkg.CheckPassword("admin_user", admin.Pwd) {
		return // Password already changed
	}

	// Generate a 12-character random password
	newPassword := generateRandomPassword(12)
	newHash := pkg.HashPassword(newPassword)
	if newHash == "" {
		log.Println("WARNING: Failed to generate bcrypt hash for new admin password")
		return
	}

	if err := db.Model(&model.User{}).Where("id = ?", admin.ID).Update("pwd", newHash).Error; err != nil {
		log.Printf("WARNING: Failed to update default admin password: %v", err)
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
