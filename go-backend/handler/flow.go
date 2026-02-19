package handler

import (
	"flux-panel/go-backend/service"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

func FlowUpload(c *gin.Context) {
	secret := c.Query("secret")
	body, _ := io.ReadAll(c.Request.Body)
	result := service.ProcessFlowUpload(string(body), secret)
	c.String(http.StatusOK, result)
}

func FlowConfig(c *gin.Context) {
	secret := c.Query("secret")
	body, _ := io.ReadAll(c.Request.Body)
	result := service.ProcessFlowConfig(string(body), secret)
	c.String(http.StatusOK, result)
}

func FlowTest(c *gin.Context) {
	c.String(http.StatusOK, "test")
}

func FlowXrayUpload(c *gin.Context) {
	secret := c.Query("secret")
	body, _ := io.ReadAll(c.Request.Body)
	result := service.ProcessXrayFlowUpload(string(body), secret)
	c.String(http.StatusOK, result)
}
