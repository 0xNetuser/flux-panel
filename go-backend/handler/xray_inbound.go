package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func XrayInboundCreate(c *gin.Context) {
	var d dto.XrayInboundDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.CreateXrayInbound(d, GetUserId(c), GetRoleId(c)))
}

func XrayInboundList(c *gin.Context) {
	var d struct {
		NodeId *int64 `json:"nodeId"`
	}
	c.ShouldBindJSON(&d)
	c.JSON(http.StatusOK, service.ListXrayInbounds(d.NodeId, GetUserId(c), GetRoleId(c)))
}

func XrayInboundUpdate(c *gin.Context) {
	var d dto.XrayInboundUpdateDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateXrayInbound(d, GetUserId(c), GetRoleId(c)))
}

func XrayInboundDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DeleteXrayInbound(d.ID, GetUserId(c), GetRoleId(c)))
}

func XrayInboundEnable(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.EnableXrayInbound(d.ID, GetUserId(c), GetRoleId(c)))
}

func XrayInboundDisable(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DisableXrayInbound(d.ID, GetUserId(c), GetRoleId(c)))
}
