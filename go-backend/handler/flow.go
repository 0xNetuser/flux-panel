package handler

import (
	"flux-panel/go-backend/service"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

const maxFlowBodySize = 10 << 20 // 10 MB

// getNodeSecret extracts the node secret from the request.
// It checks the X-Node-Secret header first, then falls back to the query parameter.
func getNodeSecret(c *gin.Context) string {
	if s := c.GetHeader("X-Node-Secret"); s != "" {
		return s
	}
	return c.Query("secret")
}

func FlowUpload(c *gin.Context) {
	secret := getNodeSecret(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFlowBodySize)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.String(http.StatusRequestEntityTooLarge, "request body too large")
		return
	}
	result := service.ProcessFlowUpload(string(body), secret)
	c.String(http.StatusOK, result)
}

func FlowConfig(c *gin.Context) {
	secret := getNodeSecret(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFlowBodySize)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.String(http.StatusRequestEntityTooLarge, "request body too large")
		return
	}
	result := service.ProcessFlowConfig(string(body), secret)
	c.String(http.StatusOK, result)
}

func FlowTest(c *gin.Context) {
	c.String(http.StatusOK, "test")
}

func FlowXrayUpload(c *gin.Context) {
	secret := getNodeSecret(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFlowBodySize)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.String(http.StatusRequestEntityTooLarge, "request body too large")
		return
	}
	result := service.ProcessXrayFlowUpload(string(body), secret)
	c.String(http.StatusOK, result)
}
