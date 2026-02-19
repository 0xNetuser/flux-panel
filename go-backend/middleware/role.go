package middleware

import (
	"flux-panel/go-backend/dto"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Admin() gin.HandlerFunc {
	return func(c *gin.Context) {
		roleId, exists := c.Get("roleId")
		if !exists {
			c.JSON(http.StatusForbidden, dto.Err("无权限"))
			c.Abort()
			return
		}
		if roleId.(int) != 0 {
			c.JSON(http.StatusForbidden, dto.Err("需要管理员权限"))
			c.Abort()
			return
		}
		c.Next()
	}
}
