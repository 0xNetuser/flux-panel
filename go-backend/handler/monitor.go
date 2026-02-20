package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func MonitorNodeHealth(c *gin.Context) {
	c.JSON(http.StatusOK, service.GetNodeHealthList())
}

func MonitorLatencyHistory(c *gin.Context) {
	var d struct {
		ForwardId int64 `json:"forwardId" binding:"required"`
		Hours     int   `json:"hours"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.GetForwardLatencyHistory(d.ForwardId, d.Hours))
}

func MonitorForwardFlowHistory(c *gin.Context) {
	var d struct {
		ForwardId int64 `json:"forwardId" binding:"required"`
		Hours     int   `json:"hours"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.GetForwardFlowHistory(d.ForwardId, d.Hours))
}

func MonitorTrafficOverview(c *gin.Context) {
	var d struct {
		Granularity string `json:"granularity"`
		Hours       int    `json:"hours"`
	}
	c.ShouldBindJSON(&d)
	c.JSON(http.StatusOK, service.GetTrafficOverview(d.Granularity, d.Hours))
}
