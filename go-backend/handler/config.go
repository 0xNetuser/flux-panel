package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func ConfigList(c *gin.Context) {
	c.JSON(http.StatusOK, service.GetConfigs())
}

func ConfigGet(c *gin.Context) {
	var d struct {
		Name string `json:"name"`
	}
	c.ShouldBindJSON(&d)
	c.JSON(http.StatusOK, service.GetConfigByName(d.Name))
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
