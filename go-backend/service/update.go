package service

import (
	"encoding/json"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	updateCache     *UpdateResult
	updateCacheMu   sync.Mutex
	updateCacheTime time.Time
	cacheTTL        = 1 * time.Hour
)

type UpdateResult struct {
	Current    string `json:"current"`
	Latest     string `json:"latest"`
	HasUpdate  bool   `json:"hasUpdate"`
	ReleaseURL string `json:"releaseUrl"`
}

func CheckUpdate() dto.R {
	updateCacheMu.Lock()
	defer updateCacheMu.Unlock()

	if updateCache != nil && time.Since(updateCacheTime) < cacheTTL {
		return dto.Ok(updateCache)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/0xNetuser/flux-panel/releases/latest")
	if err != nil {
		return dto.Err(fmt.Sprintf("检查更新失败: %v", err))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return dto.Err("读取更新信息失败")
	}

	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.Unmarshal(body, &release); err != nil {
		return dto.Err("解析更新信息失败")
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	current := strings.TrimPrefix(pkg.Version, "v")

	result := &UpdateResult{
		Current:    pkg.Version,
		Latest:     release.TagName,
		HasUpdate:  latest != current && pkg.Version != "dev",
		ReleaseURL: release.HTMLURL,
	}

	updateCache = result
	updateCacheTime = time.Now()

	return dto.Ok(result)
}
