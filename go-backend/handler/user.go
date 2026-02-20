package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Login(c *gin.Context) {
	var d dto.LoginDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.Login(d))
}

func UserCreate(c *gin.Context) {
	var d dto.UserDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.CreateUser(d))
}

func UserList(c *gin.Context) {
	c.JSON(http.StatusOK, service.GetAllUsers())
}

func UserUpdate(c *gin.Context) {
	var d dto.UserUpdateDto
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.UpdateUser(d))
}

func UserDelete(c *gin.Context) {
	var d struct {
		ID int64 `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.DeleteUser(d.ID))
}

func UserPackage(c *gin.Context) {
	userId := c.GetInt64("userId")
	roleId, _ := c.Get("roleId")
	c.JSON(http.StatusOK, service.GetUserPackageInfo(userId, roleId.(int)))
}

func UserUpdatePassword(c *gin.Context) {
	var d struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
		NewUsername      string `json:"newUsername"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	userId := c.GetInt64("userId")
	c.JSON(http.StatusOK, service.UpdatePassword(userId, dto.UpdatePasswordDto{
		OldPassword: d.CurrentPassword,
		NewPassword: d.NewPassword,
		NewUsername: d.NewUsername,
	}))
}

func UserReset(c *gin.Context) {
	var d struct {
		ID   int64 `json:"id" binding:"required"`
		Type int   `json:"type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.ResetFlow(dto.ResetFlowDto{ID: d.ID}, d.Type))
}

func GetUserId(c *gin.Context) int64 {
	return c.GetInt64("userId")
}

func GetRoleId(c *gin.Context) int {
	v, _ := c.Get("roleId")
	return v.(int)
}
