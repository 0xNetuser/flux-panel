package service

import (
	"bytes"
	"context"
	"encoding/json"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/pkg"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"regexp"
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

// getLatestRelease fetches the latest release tag and version from GitHub.
func getLatestRelease() (version string, tag string, err error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/0xNetuser/flux-panel/releases/latest")
	if err != nil {
		return "", "", fmt.Errorf("检查更新失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("读取更新信息失败")
	}

	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.Unmarshal(body, &release); err != nil {
		return "", "", fmt.Errorf("解析更新信息失败")
	}

	return strings.TrimPrefix(release.TagName, "v"), release.TagName, nil
}

func CheckUpdate() dto.R {
	updateCacheMu.Lock()
	defer updateCacheMu.Unlock()

	if updateCache != nil && time.Since(updateCacheTime) < cacheTTL {
		return dto.Ok(updateCache)
	}

	return checkUpdateNoCache()
}

// ForceCheckUpdate bypasses cache and always fetches latest from GitHub.
func ForceCheckUpdate() dto.R {
	updateCacheMu.Lock()
	defer updateCacheMu.Unlock()

	return checkUpdateNoCache()
}

// checkUpdateNoCache fetches the latest release and updates the cache.
// Caller must hold updateCacheMu.
func checkUpdateNoCache() dto.R {
	latest, tag, err := getLatestRelease()
	if err != nil {
		return dto.Err(err.Error())
	}

	current := strings.TrimPrefix(pkg.Version, "v")

	result := &UpdateResult{
		Current:    pkg.Version,
		Latest:     tag,
		HasUpdate:  latest != current && pkg.Version != "dev",
		ReleaseURL: fmt.Sprintf("https://github.com/0xNetuser/flux-panel/releases/tag/%s", tag),
	}

	updateCache = result
	updateCacheTime = time.Now()

	return dto.Ok(result)
}

// dockerRequest sends a request to the Docker Engine API via unix socket.
func dockerRequest(method, path string, body interface{}) ([]byte, error) {
	transport := &http.Transport{
		DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
			return net.Dial("unix", "/var/run/docker.sock")
		},
	}
	client := &http.Client{Transport: transport, Timeout: 30 * time.Second}

	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, "http://localhost"+path, reqBody)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Docker API error (%d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// getHostComposeDir reads the compose working directory from the backend container's labels.
func getHostComposeDir() (string, error) {
	data, err := dockerRequest("GET", "/containers/go-backend/json", nil)
	if err != nil {
		return "", fmt.Errorf("获取容器信息失败: %v", err)
	}

	var info struct {
		Config struct {
			Labels map[string]string `json:"Labels"`
		} `json:"Config"`
	}
	if err := json.Unmarshal(data, &info); err != nil {
		return "", fmt.Errorf("解析容器信息失败: %v", err)
	}

	dir, ok := info.Config.Labels["com.docker.compose.project.working_dir"]
	if !ok || dir == "" {
		return "", fmt.Errorf("未找到 compose 工作目录 label")
	}

	return dir, nil
}

func SelfUpdate() dto.R {
	// 1. Get latest version
	latestVersion, _, err := getLatestRelease()
	if err != nil {
		return dto.Err(err.Error())
	}

	current := strings.TrimPrefix(pkg.Version, "v")
	if latestVersion == current {
		return dto.Err("已是最新版本")
	}

	// 2. Read and update docker-compose.yml
	composePath := "/data/compose/docker-compose.yml"
	content, err := os.ReadFile(composePath)
	if err != nil {
		return dto.Err(fmt.Sprintf("读取 docker-compose.yml 失败: %v", err))
	}

	// Backup
	if err := os.WriteFile(composePath+".bak", content, 0644); err != nil {
		return dto.Err(fmt.Sprintf("备份 docker-compose.yml 失败: %v", err))
	}

	// Replace image tags: 0xnetuser/xxx:OLD → 0xnetuser/xxx:NEW
	re := regexp.MustCompile(`(0xnetuser/[^:]+:)\d+\.\d+\.\d+`)
	updated := re.ReplaceAllString(string(content), "${1}"+latestVersion)

	if err := os.WriteFile(composePath, []byte(updated), 0644); err != nil {
		return dto.Err(fmt.Sprintf("更新 docker-compose.yml 失败: %v", err))
	}

	// 3. Get host compose directory from container labels
	hostDir, err := getHostComposeDir()
	if err != nil {
		return dto.Err(err.Error())
	}

	// 4. Pull docker:cli image and create updater container via Docker API
	updaterImage := "docker:cli"
	pullClient := &http.Client{
		Transport: &http.Transport{
			DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
				return net.Dial("unix", "/var/run/docker.sock")
			},
		},
		Timeout: 5 * time.Minute,
	}
	pullReq, _ := http.NewRequest("POST", "http://localhost/images/create?fromImage=docker&tag=cli", nil)
	pullResp, pullErr := pullClient.Do(pullReq)
	if pullErr != nil {
		return dto.Err(fmt.Sprintf("拉取更新镜像失败: %v", pullErr))
	}
	io.Copy(io.Discard, pullResp.Body)
	pullResp.Body.Close()
	if pullResp.StatusCode >= 400 {
		return dto.Err(fmt.Sprintf("拉取更新镜像失败，状态码: %d", pullResp.StatusCode))
	}

	createBody := map[string]interface{}{
		"Image": updaterImage,
		"Cmd":   []string{"sh", "-c", "sleep 3 && cd /compose && docker compose pull && docker compose up -d"},
		"HostConfig": map[string]interface{}{
			"Binds":      []string{"/var/run/docker.sock:/var/run/docker.sock", hostDir + ":/compose"},
			"AutoRemove": true,
		},
	}

	respData, err := dockerRequest("POST", "/containers/create?name=flux-updater", createBody)
	if err != nil {
		// If container name conflicts, remove old one and retry
		if strings.Contains(err.Error(), "Conflict") {
			dockerRequest("DELETE", "/containers/flux-updater?force=true", nil)
			respData, err = dockerRequest("POST", "/containers/create?name=flux-updater", createBody)
		}
		if err != nil {
			return dto.Err(fmt.Sprintf("创建更新容器失败: %v", err))
		}
	}

	var createResp struct {
		Id string `json:"Id"`
	}
	if err := json.Unmarshal(respData, &createResp); err != nil {
		return dto.Err(fmt.Sprintf("解析容器ID失败: %v", err))
	}

	// Start the updater container
	if _, err := dockerRequest("POST", "/containers/"+createResp.Id+"/start", nil); err != nil {
		return dto.Err(fmt.Sprintf("启动更新容器失败: %v", err))
	}

	// Clear update cache so next check reflects new state
	updateCacheMu.Lock()
	updateCache = nil
	updateCacheMu.Unlock()

	return dto.Ok("更新已启动，面板将在几秒后自动重启")
}
