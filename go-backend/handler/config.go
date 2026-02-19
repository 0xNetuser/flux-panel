package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

// isAdminRequest checks if the request has a valid admin JWT.
func isAdminRequest(c *gin.Context) bool {
	token := c.GetHeader("Authorization")
	if token == "" || !pkg.ValidateToken(token) {
		return false
	}
	roleId, err := pkg.GetRoleIdFromToken(token)
	if err != nil {
		return false
	}
	return roleId == 0
}

func ConfigList(c *gin.Context) {
	if isAdminRequest(c) {
		c.JSON(http.StatusOK, service.GetConfigs())
	} else {
		c.JSON(http.StatusOK, service.GetPublicConfigs())
	}
}

func ConfigGet(c *gin.Context) {
	var d struct {
		Name string `json:"name"`
	}
	c.ShouldBindJSON(&d)
	if isAdminRequest(c) {
		c.JSON(http.StatusOK, service.GetConfigByName(d.Name))
	} else {
		c.JSON(http.StatusOK, service.GetPublicConfigByName(d.Name))
	}
}

func ConfigUpdate(c *gin.Context) {
	var d map[string]string
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateConfigs(d))
}

func ConfigUpdateSingle(c *gin.Context) {
	var d struct {
		Name  string `json:"name" binding:"required"`
		Value string `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateSingleConfig(d.Name, d.Value))
}
