package handler

import (
	"flux-panel/go-backend/dto"
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
