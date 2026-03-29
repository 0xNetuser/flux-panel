package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"flux-panel/go-backend/service"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func versionLessThan(a, b string) bool {
	parse := func(v string) [3]int {
		v = strings.TrimSpace(v)
		v = strings.TrimPrefix(v, "v")
		if v == "" || v == "dev" {
			return [3]int{0, 0, 0}
		}
		if idx := strings.Index(v, "-"); idx >= 0 {
			v = v[:idx]
		}
		parts := strings.Split(v, ".")
		var out [3]int
		for i := 0; i < len(parts) && i < 3; i++ {
			if n, err := strconv.Atoi(parts[i]); err == nil {
				out[i] = n
			}
		}
		return out
	}
	pa := parse(a)
	pb := parse(b)
	for i := 0; i < 3; i++ {
		if pa[i] != pb[i] {
			return pa[i] < pb[i]
		}
	}
	return false
}

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

func NodeSetProtocol(c *gin.Context) {
	var d dto.NodeSetProtocolDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.SetNodeProtocol(d))
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
	var d struct {
		XrayOnly bool `json:"xrayOnly"`
		GostOnly bool `json:"gostOnly"`
	}
	_ = c.ShouldBindJSON(&d)
	c.JSON(http.StatusOK, service.GetUserAccessibleNodes(userId, roleId, d.XrayOnly, d.GostOnly))
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

func NodeUpdateOrder(c *gin.Context) {
	var d struct {
		Items []dto.OrderItem `json:"items" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateNodeOrder(d.Items))
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

	// Legacy nodes (no disguise name) must be reinstalled manually
	node := service.GetNodeById(d.ID)
	if node != nil && node.DisguiseName == "" && versionLessThan(node.Version, "2.1.0") {
		c.JSON(http.StatusOK, dto.Err("该节点需要使用新的安装命令重新安装，请在节点管理页面点击安装按钮获取新命令"))
		return
	}

	panelAddr := service.GetPanelAddress("")
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
