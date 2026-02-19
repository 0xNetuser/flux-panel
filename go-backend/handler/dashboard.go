package handler

import (
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func DashboardStats(c *gin.Context) {
	roleId, _ := c.Get("roleId")
	if roleId == 0 {
		c.JSON(http.StatusOK, service.GetAdminDashboardStats())
		return
	}
	userId := c.GetInt64("userId")
	c.JSON(http.StatusOK, service.GetUserDashboardStats(userId))
}
