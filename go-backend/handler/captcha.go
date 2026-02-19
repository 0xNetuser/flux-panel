package handler

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func CaptchaCheck(c *gin.Context) {
	var d struct {
		CaptchaId string `json:"captchaId"`
	}
	c.ShouldBindJSON(&d)
	if service.CaptchaCheck(d.CaptchaId) {
		c.JSON(http.StatusOK, dto.Ok("验证通过"))
	} else {
		c.JSON(http.StatusOK, dto.Err("验证失败"))
	}
}

func CaptchaGenerate(c *gin.Context) {
	c.JSON(http.StatusOK, service.CaptchaGenerate())
}

func CaptchaVerify(c *gin.Context) {
	var d struct {
		CaptchaId string `json:"captchaId"`
		Answer    string `json:"answer"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	c.JSON(http.StatusOK, service.CaptchaVerify(d.CaptchaId, d.Answer))
}
