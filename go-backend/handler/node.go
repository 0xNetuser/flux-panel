package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func NodeCreate(c *gin.Context) {
	var d dto.NodeDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.CreateNode(d))
}

func NodeList(c *gin.Context) {
	c.JSON(http.StatusOK, service.GetAllNodes())
}

func NodeUpdate(c *gin.Context) {
	var d dto.NodeUpdateDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateNode(d))
}

func NodeDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DeleteNode(d.ID))
}

func NodeListAccessible(c *gin.Context) {
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.GetUserAccessibleNodes(userId, roleId))
}

func NodeInstall(c *gin.Context) {
	var d struct {
		ID        int64  `json:"id" binding:"required"`
		PanelAddr string `json:"panelAddr"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.GenerateInstallCommand(d.ID, d.PanelAddr))
}

func NodeInstallDocker(c *gin.Context) {
	var d struct {
		ID        int64  `json:"id" binding:"required"`
		PanelAddr string `json:"panelAddr"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.GenerateDockerInstallCommand(d.ID, d.PanelAddr))
}

func NodeReconcile(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.ReconcileNodeAPI(d.ID))
}

func NodeUpdateBinary(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	// 安全：不接受前端传入的 panelAddr，从数据库配置或 request Host 推导
	scheme := "http"
	if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	clientOrigin := scheme + "://" + c.Request.Host
	panelAddr := service.GetPanelAddress(clientOrigin)
	result := pkg.NodeUpdateBinary(d.ID, panelAddr)
	if result == nil || result.Msg != "OK" {
		msg := "节点更新失败"
		if result != nil {
			msg = result.Msg
		}
		c.JSON(http.StatusOK, dto.Err(msg))
		return
	}
	c.JSON(http.StatusOK, dto.Ok(result))
}
