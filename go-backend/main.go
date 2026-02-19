package main

import (
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
