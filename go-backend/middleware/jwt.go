package middleware

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func JWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		method := c.Request.Method

		// 排除不需要认证的路径
		if isExcluded(path, method) {
			c.Next()
			return
		}

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

func isExcluded(path, method string) bool {
	excludes := []string{
		"/flow/",
		"/api/v1/open_api/",
		"/api/v1/user/login",
		"/api/v1/captcha/",
		"/api/v1/config/get",
		"/api/v1/config/list",
		"/node-install/",
	}
	for _, e := range excludes {
		if strings.HasPrefix(path, e) {
			return true
		}
	}
	// GET /api/v1/xray/sub/
	if method == "GET" && strings.HasPrefix(path, "/api/v1/xray/sub/") {
		return true
	}
	return false
}
