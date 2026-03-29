package router

import (
	"flux-panel/go-backend/handler"
	"flux-panel/go-backend/middleware"
	"flux-panel/go-backend/pkg"

	"github.com/gin-gonic/gin"
)

func Setup(r *gin.Engine) {
	// CORS
	r.Use(middleware.CORS())
	// Request logger
	r.Use(middleware.Logger())

	// ─── Public routes (no auth) ───

	// User login (rate limited — separate bucket from captcha)
	r.POST("/api/v1/user/login", middleware.LoginRateLimit(), handler.Login)

	// Captcha (rate limited — separate bucket from login)
	r.POST("/api/v1/captcha/check", middleware.CaptchaRateLimit(), handler.CaptchaCheck)
	r.POST("/api/v1/captcha/generate", middleware.CaptchaRateLimit(), handler.CaptchaGenerate)
	r.POST("/api/v1/captcha/verify", middleware.CaptchaRateLimit(), handler.CaptchaVerify)

	// Config (public read)
	r.POST("/api/v1/config/list", handler.ConfigList)
	r.POST("/api/v1/config/get", handler.ConfigGet)

	// Flow upload (node calls, secret-based auth)
	r.POST("/flow/upload", handler.FlowUpload)
	r.POST("/flow/config", handler.FlowConfig)
	r.GET("/flow/test", handler.FlowTest)
	r.POST("/flow/test", handler.FlowTest)
	r.POST("/flow/su", handler.FlowXrayUpload)
	r.POST("/flow/xray-upload", handler.FlowXrayUpload) // backward compat

	// Node install (legacy routes — kept for backward compatibility)
	r.GET("/node-install/script", handler.NodeInstallScript)
	r.GET("/node-install/binary/:arch", handler.NodeInstallBinary)
	r.GET("/node-install/xray/:arch", handler.NodeInstallXray)
	r.GET("/node-install/uninstall", handler.NodeUninstallScript)

	// Camouflaged node install (secret in path = auth)
	r.GET("/s/:secret/init", handler.CamoInstallScript)
	r.GET("/s/:secret/b/:arch", handler.CamoInstallBinary)
	r.GET("/s/:secret/x/:arch", handler.CamoInstallXray)

	// Subscription (token in path)
	r.GET("/api/v1/v/sub/:token", handler.XraySubscription)
	r.GET("/api/v1/xray/sub/:token", handler.XraySubscription) // backward compat

	// Open API
	r.GET("/api/v1/open_api/sub_store", handler.SubStore)

	// Version (public)
	r.GET("/api/v1/version", handler.GetVersion)

	// WebSocket
	r.GET("/system-info", func(c *gin.Context) {
		pkg.WS.HandleConnection(c.Writer, c.Request)
	})

	// ─── Authenticated routes ───

	auth := r.Group("/api/v1")
	auth.Use(middleware.JWT())
	{
		// User
		auth.POST("/user/create", middleware.Admin(), handler.UserCreate)
		auth.POST("/user/list", middleware.Admin(), handler.UserList)
		auth.POST("/user/update", middleware.Admin(), handler.UserUpdate)
		auth.POST("/user/delete", middleware.Admin(), handler.UserDelete)
		auth.POST("/user/package", handler.UserPackage)
		auth.POST("/user/updatePassword", handler.UserUpdatePassword)
		auth.POST("/user/reset", middleware.Admin(), handler.UserReset)

		// Node
		auth.POST("/node/create", middleware.Admin(), handler.NodeCreate)
		auth.POST("/node/list", middleware.Admin(), handler.NodeList)
		auth.POST("/node/accessible", handler.NodeListAccessible)
		auth.POST("/node/update", middleware.Admin(), handler.NodeUpdate)
		auth.POST("/node/delete", middleware.Admin(), handler.NodeDelete)
		auth.POST("/node/install", middleware.Admin(), handler.NodeInstall)
		auth.POST("/node/install/docker", middleware.Admin(), handler.NodeInstallDocker)
		auth.POST("/node/reconcile", middleware.Admin(), handler.NodeReconcile)
		auth.POST("/node/update-binary", middleware.Admin(), handler.NodeUpdateBinary)
		auth.POST("/node/update-order", middleware.Admin(), handler.NodeUpdateOrder)
		auth.POST("/node/set-protocol", middleware.Admin(), handler.NodeSetProtocol)

		// Tunnel
		auth.POST("/tunnel/create", middleware.Admin(), handler.TunnelCreate)
		auth.POST("/tunnel/list", middleware.Admin(), handler.TunnelList)
		auth.POST("/tunnel/update", middleware.Admin(), handler.TunnelUpdate)
		auth.POST("/tunnel/delete", middleware.Admin(), handler.TunnelDelete)
		auth.POST("/tunnel/user/assign", middleware.Admin(), handler.TunnelUserAssign)
		auth.POST("/tunnel/user/list", middleware.Admin(), handler.TunnelUserList)
		auth.POST("/tunnel/user/remove", middleware.Admin(), handler.TunnelUserRemove)
		auth.POST("/tunnel/user/update", middleware.Admin(), handler.TunnelUserUpdate)
		auth.POST("/tunnel/user/tunnel", handler.TunnelUserTunnel)
		auth.POST("/tunnel/diagnose", middleware.Admin(), handler.TunnelDiagnose)
		auth.POST("/tunnel/update-order", middleware.Admin(), handler.TunnelUpdateOrder)

		// Forward
		auth.POST("/forward/create", handler.ForwardCreate)
		auth.POST("/forward/list", handler.ForwardList)
		auth.POST("/forward/update", handler.ForwardUpdate)
		auth.POST("/forward/delete", handler.ForwardDelete)
		auth.POST("/forward/force-delete", middleware.Admin(), handler.ForwardForceDelete)
		auth.POST("/forward/pause", handler.ForwardPause)
		auth.POST("/forward/resume", handler.ForwardResume)
		auth.POST("/forward/diagnose", handler.ForwardDiagnose)
		auth.GET("/flow/debug", middleware.Admin(), handler.FlowDebug)
		auth.POST("/forward/update-order", handler.ForwardUpdateOrder)

		// Speed Limit
		auth.POST("/speed-limit/create", middleware.Admin(), handler.SpeedLimitCreate)
		auth.POST("/speed-limit/list", middleware.Admin(), handler.SpeedLimitList)
		auth.POST("/speed-limit/update", middleware.Admin(), handler.SpeedLimitUpdate)
		auth.POST("/speed-limit/delete", middleware.Admin(), handler.SpeedLimitDelete)
		auth.POST("/speed-limit/tunnels", middleware.Admin(), handler.SpeedLimitTunnels)

		// Config (admin write)
		auth.POST("/config/update", middleware.Admin(), handler.ConfigUpdate)
		auth.POST("/config/update-single", middleware.Admin(), handler.ConfigUpdateSingle)

		// Proxy Inbound (permission checked in service layer)
		auth.POST("/v/inbound/create", handler.XrayInboundCreate)
		auth.POST("/v/inbound/list", handler.XrayInboundList)
		auth.POST("/v/inbound/update", handler.XrayInboundUpdate)
		auth.POST("/v/inbound/delete", handler.XrayInboundDelete)
		auth.POST("/v/inbound/enable", handler.XrayInboundEnable)
		auth.POST("/v/inbound/disable", handler.XrayInboundDisable)
		auth.POST("/v/inbound/genkey", handler.XrayInboundGenKey)

		// Proxy Client (permission checked in service layer)
		auth.POST("/v/client/create", handler.XrayClientCreate)
		auth.POST("/v/client/list", handler.XrayClientList)
		auth.POST("/v/client/update", handler.XrayClientUpdate)
		auth.POST("/v/client/delete", handler.XrayClientDelete)
		auth.POST("/v/client/reset-traffic", handler.XrayClientResetTraffic)
		auth.POST("/v/client/link", handler.XrayClientLink)

		// Proxy Cert (permission checked in service layer)
		auth.POST("/v/cert/create", handler.XrayCertCreate)
		auth.POST("/v/cert/list", handler.XrayCertList)
		auth.POST("/v/cert/delete", handler.XrayCertDelete)
		auth.POST("/v/cert/issue", handler.XrayCertIssue)
		auth.POST("/v/cert/renew", handler.XrayCertRenew)

		// Proxy Node
		auth.POST("/v/node/start", middleware.Admin(), handler.XrayNodeStart)
		auth.POST("/v/node/stop", middleware.Admin(), handler.XrayNodeStop)
		auth.POST("/v/node/restart", middleware.Admin(), handler.XrayNodeRestart)
		auth.POST("/v/node/status", middleware.Admin(), handler.XrayNodeStatus)
		auth.POST("/v/node/switch-version", middleware.Admin(), handler.XrayNodeSwitchVersion)
		auth.GET("/v/node/versions", middleware.Admin(), handler.XrayNodeVersions)

		// Subscription
		auth.POST("/v/sub/token", handler.XraySubToken)
		auth.POST("/v/sub/links", handler.XraySubLinks)
		auth.POST("/v/sub/reset", handler.XraySubReset)

		// Monitor
		auth.POST("/monitor/node-health", middleware.Admin(), handler.MonitorNodeHealth)
		auth.POST("/monitor/latency-history", handler.MonitorLatencyHistory)
		auth.POST("/monitor/forward-flow", middleware.Admin(), handler.MonitorForwardFlowHistory)
		auth.POST("/monitor/traffic-overview", middleware.Admin(), handler.MonitorTrafficOverview)
		auth.POST("/monitor/v-traffic-overview", middleware.Admin(), handler.MonitorXrayTrafficOverview)
		auth.POST("/monitor/v-inbound-flow", middleware.Admin(), handler.MonitorXrayInboundFlowHistory)

		// Dashboard
		auth.POST("/dashboard/stats", handler.DashboardStats)

		// System
		auth.POST("/system/check-update", middleware.Admin(), handler.CheckUpdate)
		auth.POST("/system/force-check-update", middleware.Admin(), handler.ForceCheckUpdate)
		auth.POST("/system/update", middleware.Admin(), handler.SelfUpdate)
	}
}
