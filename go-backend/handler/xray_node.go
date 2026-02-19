package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"net/http"

	"github.com/gin-gonic/gin"
)

func XrayNodeStart(c *gin.Context) {
	var d struct {
		NodeId int64 `json:"nodeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XrayStart(d.NodeId)
	c.JSON(http.StatusOK, dto.Ok(result))
}

func XrayNodeStop(c *gin.Context) {
	var d struct {
		NodeId int64 `json:"nodeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XrayStop(d.NodeId)
	c.JSON(http.StatusOK, dto.Ok(result))
}

func XrayNodeRestart(c *gin.Context) {
	var d struct {
		NodeId int64 `json:"nodeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XrayRestart(d.NodeId)
	c.JSON(http.StatusOK, dto.Ok(result))
}

func XrayNodeStatus(c *gin.Context) {
	var d struct {
		NodeId int64 `json:"nodeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XrayStatus(d.NodeId)
	c.JSON(http.StatusOK, dto.Ok(result))
}
