package middleware

import (
	"flux-panel/go-backend/config"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowedOrigins := config.Cfg.AllowedOrigins

		if len(allowedOrigins) == 0 {
			// No restriction configured — allow all (backward compatible)
			c.Header("Access-Control-Allow-Origin", "*")
		} else {
			// Check if the request origin is in the allowed list
			allowed := false
			for _, o := range allowedOrigins {
				if o == origin {
					allowed = true
					break
				}
			}
			if allowed {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
			}
			// If not allowed, omit the header — browser will block the request
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, Accept, X-Node-Secret")
		c.Header("Access-Control-Expose-Headers", "Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
