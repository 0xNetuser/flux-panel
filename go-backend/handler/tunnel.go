package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func TunnelCreate(c *gin.Context) {
	var d dto.TunnelDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.CreateTunnel(d))
}

func TunnelList(c *gin.Context) {
	c.JSON(http.StatusOK, service.GetAllTunnels())
}

func TunnelUpdate(c *gin.Context) {
	var d dto.TunnelUpdateDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateTunnel(d))
}

func TunnelDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DeleteTunnel(d.ID))
}

func TunnelUserAssign(c *gin.Context) {
	var d dto.UserTunnelDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.AssignUserTunnel(d))
}

func TunnelUserList(c *gin.Context) {
	var d struct {
		TunnelId *int64 `json:"tunnelId"`
		UserId   *int64 `json:"userId"`
	}
	c.ShouldBindJSON(&d)
	c.JSON(http.StatusOK, service.ListUserTunnels(d.TunnelId, d.UserId))
}

func TunnelUserRemove(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.RemoveUserTunnel(d.ID))
}

func TunnelUserUpdate(c *gin.Context) {
	var d dto.UserTunnelUpdateDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateUserTunnel(d))
}

func TunnelUserTunnel(c *gin.Context) {
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.GetUserAccessibleTunnels(userId, roleId))
}

func TunnelDiagnose(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DiagnoseTunnel(d.ID))
}
