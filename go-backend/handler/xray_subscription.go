package handler

import (
	"encoding/base64"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"flux-panel/go-backend/service"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func XraySubscription(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.String(http.StatusBadRequest, "invalid token")
		return
	}

	if !pkg.ValidateToken(token) {
		c.String(http.StatusUnauthorized, "invalid or expired token")
		return
	}

	userId, err := pkg.GetUserIdFromToken(token)
	if err != nil {
		c.String(http.StatusUnauthorized, "invalid token")
		return
	}

	result := service.GetSubscriptionLinks(userId)
	if result.Code != 0 {
		c.String(http.StatusInternalServerError, result.Msg)
		return
	}

	links, ok := result.Data.([]map[string]interface{})
	if !ok || len(links) == 0 {
		c.String(http.StatusOK, "")
		return
	}

	var linkStrs []string
	for _, item := range links {
		if link, ok := item["link"].(string); ok {
			linkStrs = append(linkStrs, link)
		}
	}

	encoded := base64.StdEncoding.EncodeToString([]byte(strings.Join(linkStrs, "\n")))
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, encoded)
}

func XraySubToken(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusOK, dto.Err("未登录"))
		return
	}
	// Return the user's JWT token for subscription URL
	c.JSON(http.StatusOK, dto.Ok(map[string]interface{}{
		"token": token,
	}))
}

func XraySubLinks(c *gin.Context) {
	userId := GetUserId(c)
	c.JSON(http.StatusOK, service.GetSubscriptionLinks(userId))
}

func GetSubStore(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.String(http.StatusBadRequest, "missing token")
		return
	}

	if !pkg.ValidateToken(token) {
		c.String(http.StatusUnauthorized, "invalid token")
		return
	}

	userId, err := pkg.GetUserIdFromToken(token)
	if err != nil {
		c.String(http.StatusUnauthorized, "invalid token")
		return
	}

	// Get user info
	var user model.User
	if err := service.DB.First(&user, userId).Error; err != nil {
		c.String(http.StatusNotFound, "user not found")
		return
	}

	result := service.GetSubscriptionLinks(userId)
	if result.Code != 0 {
		c.String(http.StatusInternalServerError, result.Msg)
		return
	}

	links, ok := result.Data.([]map[string]interface{})
	if !ok || len(links) == 0 {
		c.String(http.StatusOK, "")
		return
	}

	var linkStrs []string
	for _, item := range links {
		if link, ok := item["link"].(string); ok {
			linkStrs = append(linkStrs, link)
		}
	}

	encoded := base64.StdEncoding.EncodeToString([]byte(strings.Join(linkStrs, "\n")))
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, encoded)
}
