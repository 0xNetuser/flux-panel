package handler

import (
	"encoding/json"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// 版本缓存
var (
	versionCache     []map[string]string
	versionCacheTime time.Time
	versionCacheMu   sync.Mutex
)

func XrayNodeVersions(c *gin.Context) {
	versionCacheMu.Lock()
	if versionCache != nil && time.Since(versionCacheTime) < 5*time.Minute {
		cached := versionCache
		versionCacheMu.Unlock()
		c.JSON(http.StatusOK, dto.Ok(cached))
		return
	}
	versionCacheMu.Unlock()

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/XTLS/Xray-core/releases?per_page=30")
	if err != nil {
		c.JSON(http.StatusOK, dto.Err("请求 GitHub API 失败"))
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var releases []struct {
		TagName     string `json:"tag_name"`
		Prerelease  bool   `json:"prerelease"`
		PublishedAt string `json:"published_at"`
	}
	if err := json.Unmarshal(body, &releases); err != nil {
		c.JSON(http.StatusOK, dto.Err("解析 GitHub API 响应失败"))
		return
	}

	var versions []map[string]string
	for _, r := range releases {
		if r.Prerelease {
			continue
		}
		v := r.TagName
		if len(v) > 0 && v[0] == 'v' {
			v = v[1:]
		}
		versions = append(versions, map[string]string{
			"version":     v,
			"publishedAt": r.PublishedAt,
		})
	}

	versionCacheMu.Lock()
	versionCache = versions
	versionCacheTime = time.Now()
	versionCacheMu.Unlock()

	c.JSON(http.StatusOK, dto.Ok(versions))
}

func XrayNodeStart(c *gin.Context) {
	var d struct {
		NodeId int64 `json:"nodeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XrayStart(d.NodeId)
	c.JSON(http.StatusOK, dto.Ok(result))
}

func XrayNodeStop(c *gin.Context) {
	var d struct {
		NodeId int64 `json:"nodeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XrayStop(d.NodeId)
	c.JSON(http.StatusOK, dto.Ok(result))
}

func XrayNodeRestart(c *gin.Context) {
	var d struct {
		NodeId int64 `json:"nodeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XrayRestart(d.NodeId)
	c.JSON(http.StatusOK, dto.Ok(result))
}

func XrayNodeStatus(c *gin.Context) {
	var d struct {
		NodeId int64 `json:"nodeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XrayStatus(d.NodeId)
	c.JSON(http.StatusOK, dto.Ok(result))
}

func XrayNodeSwitchVersion(c *gin.Context) {
	var d struct {
		NodeId  int64  `json:"nodeId" binding:"required"`
		Version string `json:"version" binding:"required"`
	}
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusOK, dto.Err("参数错误"))
		return
	}
	result := pkg.XraySwitchVersion(d.NodeId, d.Version)
	c.JSON(http.StatusOK, dto.Ok(result))
}
