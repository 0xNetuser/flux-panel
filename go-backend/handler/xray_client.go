package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func XrayClientCreate(c *gin.Context) {
	var d dto.XrayClientDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.CreateXrayClient(d, GetUserId(c), GetRoleId(c)))
}

func XrayClientList(c *gin.Context) {
	var d struct {
		InboundId *int64 `json:"inboundId"`
		UserId    *int64 `json:"userId"`
	}
	c.ShouldBindJSON(&d)
	c.JSON(http.StatusOK, service.ListXrayClients(d.InboundId, d.UserId, GetUserId(c), GetRoleId(c)))
}

func XrayClientUpdate(c *gin.Context) {
	var d dto.XrayClientUpdateDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateXrayClient(d, GetUserId(c), GetRoleId(c)))
}

func XrayClientDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DeleteXrayClient(d.ID, GetUserId(c), GetRoleId(c)))
}

func XrayClientResetTraffic(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.ResetXrayClientTraffic(d.ID, GetUserId(c), GetRoleId(c)))
}

func XrayClientLink(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.GetClientLink(d.ID, GetUserId(c), GetRoleId(c)))
}
