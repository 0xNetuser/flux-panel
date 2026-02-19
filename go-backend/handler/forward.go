package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func ForwardCreate(c *gin.Context) {
	var d dto.ForwardDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	userName, _ := c.Get("userName")
	c.JSON(http.StatusOK, service.CreateForward(d, userId, roleId, userName.(string)))
}

func ForwardList(c *gin.Context) {
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.GetAllForwards(userId, roleId))
}

func ForwardUpdate(c *gin.Context) {
	var d dto.ForwardUpdateDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.UpdateForward(d, userId, roleId))
}

func ForwardDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.DeleteForward(d.ID, userId, roleId))
}

func ForwardForceDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.ForceDeleteForward(d.ID))
}

func ForwardPause(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.PauseForward(d.ID, userId, roleId))
}

func ForwardResume(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.ResumeForward(d.ID, userId, roleId))
}

func ForwardDiagnose(c *gin.Context) {
	var d struct {
		ID int64 `json:"forwardId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.DiagnoseForward(d.ID, userId, roleId))
}

func ForwardUpdateOrder(c *gin.Context) {
	var d map[string]interface{}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	userId := GetUserId(c)
	roleId := GetRoleId(c)
	c.JSON(http.StatusOK, service.UpdateForwardOrder(d, userId, roleId))
}
