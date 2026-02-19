package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func XrayCertCreate(c *gin.Context) {
	var d dto.XrayTlsCertDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.CreateXrayTlsCert(d, GetUserId(c), GetRoleId(c)))
}

func XrayCertList(c *gin.Context) {
	var d struct {
		NodeId *int64 `json:"nodeId"`
	}
	c.ShouldBindJSON(&d)
	c.JSON(http.StatusOK, service.ListXrayTlsCerts(d.NodeId, GetUserId(c), GetRoleId(c)))
}

func XrayCertDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DeleteXrayTlsCert(d.ID, GetUserId(c), GetRoleId(c)))
}

func XrayCertIssue(c *gin.Context) {
	var d dto.XrayCertIssueDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.IssueCertificate(d.ID, GetUserId(c), GetRoleId(c)))
}

func XrayCertRenew(c *gin.Context) {
	var d dto.XrayCertRenewDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.RenewCertificate(d.ID, GetUserId(c), GetRoleId(c)))
}
