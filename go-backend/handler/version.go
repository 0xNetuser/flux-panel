package handler

import (
	"flux-panel/go-backend/pkg"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetVersion(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"version": pkg.Version,
		},
	})
}
