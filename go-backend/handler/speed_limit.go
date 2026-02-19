package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func SpeedLimitCreate(c *gin.Context) {
	var d dto.SpeedLimitDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.CreateSpeedLimit(d))
}

func SpeedLimitList(c *gin.Context) {
	c.JSON(http.StatusOK, service.GetAllSpeedLimits())
}

func SpeedLimitUpdate(c *gin.Context) {
	var d dto.SpeedLimitUpdateDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateSpeedLimit(d))
}

func SpeedLimitDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DeleteSpeedLimit(d.ID))
}

func SpeedLimitTunnels(c *gin.Context) {
	var d struct {
		TunnelId int64 `json:"tunnelId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.GetSpeedLimitsByTunnel(d.TunnelId))
}
