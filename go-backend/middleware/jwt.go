package middleware

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"net/http"

	"github.com/gin-gonic/gin"
)

// JWT validates the Authorization header for authenticated route groups.
// Public routes are registered outside the auth group and never hit this middleware.
func JWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, dto.ErrCode(401, "未登录"))
			c.Abort()
			return
		}

		if !pkg.ValidateToken(token) {
			c.JSON(http.StatusUnauthorized, dto.ErrCode(401, "token无效或已过期"))
			c.Abort()
			return
		}

		userId, err := pkg.GetUserIdFromToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, dto.ErrCode(401, "token解析失败"))
			c.Abort()
			return
		}

		roleId, _ := pkg.GetRoleIdFromToken(token)
		name, _ := pkg.GetNameFromToken(token)

		c.Set("userId", userId)
		c.Set("roleId", roleId)
		c.Set("userName", name)
		c.Set("token", token)

		c.Next()
	}
}
