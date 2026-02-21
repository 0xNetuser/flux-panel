package handler

import (
	"flux-panel/go-backend/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func CheckUpdate(c *gin.Context) {
	c.JSON(http.StatusOK, service.CheckUpdate())
}

func ForceCheckUpdate(c *gin.Context) {
	c.JSON(http.StatusOK, service.ForceCheckUpdate())
}

func SelfUpdate(c *gin.Context) {
	c.JSON(http.StatusOK, service.SelfUpdate())
}
