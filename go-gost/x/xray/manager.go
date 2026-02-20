package xray

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
)

// XrayManager manages the Xray process lifecycle
type XrayManager struct {
	binaryPath string
	configPath string
	grpcAddr   string
	cmd        *exec.Cmd
	running    bool
	mu         sync.Mutex
	version    string
}

// NewXrayManager creates a new XrayManager
func NewXrayManager(binaryPath, configPath, grpcAddr string) *XrayManager {
	if binaryPath == "" {
		binaryPath = "xray"
	}
	if configPath == "" {
		configPath = "xray_config.json"
	}
	if grpcAddr == "" {
		grpcAddr = "127.0.0.1:10085"
	}
	return &XrayManager{
		binaryPath: binaryPath,
		configPath: configPath,
		grpcAddr:   grpcAddr,
	}
}

// Start starts the Xray process
func (m *XrayManager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running && m.cmd != nil && m.cmd.Process != nil {
		return fmt.Errorf("Xray is already running")
	}

	// Ensure config file exists
	if err := m.ensureBaseConfig(); err != nil {
		return fmt.Errorf("failed to ensure base config: %v", err)
	}

	absConfig, err := filepath.Abs(m.configPath)
	if err != nil {
		absConfig = m.configPath
	}

	m.cmd = exec.Command(m.binaryPath, "run", "-c", absConfig)
	m.cmd.Stdout = os.Stdout
	m.cmd.Stderr = os.Stderr

	if err := m.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start Xray: %v", err)
	}

	m.running = true
	fmt.Printf("✅ Xray started with PID %d\n", m.cmd.Process.Pid)

	// Monitor process in background
	go func() {
		if err := m.cmd.Wait(); err != nil {
			fmt.Printf("⚠️ Xray process exited: %v\n", err)
		}
		m.mu.Lock()
		m.running = false
		m.mu.Unlock()
	}()

	return nil
}

// Stop stops the Xray process
func (m *XrayManager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running || m.cmd == nil || m.cmd.Process == nil {
		m.running = false
		return nil
	}

	// Send SIGTERM first
	if err := m.cmd.Process.Signal(syscall.SIGTERM); err != nil {
		// Force kill if SIGTERM fails
		m.cmd.Process.Kill()
	}

	// Wait with timeout
	done := make(chan struct{})
	go func() {
		m.cmd.Wait()
		close(done)
	}()

	select {
	case <-done:
		// Process exited cleanly
	case <-time.After(5 * time.Second):
		// Force kill after timeout
		m.cmd.Process.Kill()
	}

	m.running = false
	fmt.Printf("🛑 Xray stopped\n")
	return nil
}

// Restart restarts the Xray process
func (m *XrayManager) Restart() error {
	if err := m.Stop(); err != nil {
		fmt.Printf("⚠️ Error stopping Xray: %v\n", err)
	}
	time.Sleep(500 * time.Millisecond)
	return m.Start()
}

// IsRunning returns whether Xray is currently running
func (m *XrayManager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running
}

// GetVersion returns the Xray version number (e.g. "25.1.30")
func (m *XrayManager) GetVersion() string {
	if m.version != "" {
		return m.version
	}

	cmd := exec.Command(m.binaryPath, "version")
	output, err := cmd.Output()
	if err != nil {
		return "unknown"
	}

	// Parse version from output like "Xray 25.1.30 (Xray, ...) ..."
	// Extract just the version number from the first line
	firstLine := strings.SplitN(string(output), "\n", 2)[0]
	fields := strings.Fields(firstLine)
	if len(fields) >= 2 {
		m.version = fields[1]
	} else {
		m.version = strings.TrimSpace(firstLine)
	}
	return m.version
}

// GetGrpcAddr returns the gRPC address
func (m *XrayManager) GetGrpcAddr() string {
	return m.grpcAddr
}

// SwitchVersion downloads and replaces the Xray binary with the specified version.
// This method is designed to be called in a goroutine (async).
func (m *XrayManager) SwitchVersion(version string) error {
	// Map GOARCH to Xray release arch suffix
	archMap := map[string]string{
		"amd64": "64",
		"arm64": "arm64-v8a",
		"arm":   "arm32-v7a",
	}
	arch, ok := archMap[runtime.GOARCH]
	if !ok {
		return fmt.Errorf("unsupported architecture: %s", runtime.GOARCH)
	}

	downloadURL := fmt.Sprintf("https://github.com/XTLS/Xray-core/releases/download/v%s/Xray-linux-%s.zip", version, arch)
	binaryPath := "/usr/local/bin/xray"
	backupPath := "/usr/local/bin/xray.bak"

	fmt.Printf("⬇️ Downloading Xray v%s from %s\n", version, downloadURL)

	// 1. Download zip to temp file
	tmpFile, err := os.CreateTemp("", "xray-*.zip")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	httpClient := &http.Client{Timeout: 5 * time.Minute}
	resp, err := httpClient.Get(downloadURL)
	if err != nil {
		tmpFile.Close()
		return fmt.Errorf("failed to download: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		tmpFile.Close()
		return fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		tmpFile.Close()
		return fmt.Errorf("failed to save download: %v", err)
	}
	tmpFile.Close()

	// 2. Extract xray binary from zip
	extractedBinary, err := extractXrayFromZip(tmpPath)
	if err != nil {
		return fmt.Errorf("failed to extract xray binary: %v", err)
	}
	defer os.Remove(extractedBinary)

	// 3. Stop Xray
	fmt.Printf("🛑 Stopping Xray for version switch...\n")
	if err := m.Stop(); err != nil {
		fmt.Printf("⚠️ Error stopping Xray: %v\n", err)
	}
	time.Sleep(500 * time.Millisecond)

	// 4. Backup old binary
	if _, err := os.Stat(binaryPath); err == nil {
		if err := copyFile(binaryPath, backupPath); err != nil {
			return fmt.Errorf("failed to backup old binary: %v", err)
		}
		fmt.Printf("📦 Backed up old binary to %s\n", backupPath)
	}

	// 5. Replace binary
	if err := copyFile(extractedBinary, binaryPath); err != nil {
		// Restore backup on failure
		if _, statErr := os.Stat(backupPath); statErr == nil {
			copyFile(backupPath, binaryPath)
		}
		m.Start()
		return fmt.Errorf("failed to replace binary: %v", err)
	}

	if err := os.Chmod(binaryPath, 0755); err != nil {
		// Restore backup on failure
		if _, statErr := os.Stat(backupPath); statErr == nil {
			copyFile(backupPath, binaryPath)
		}
		m.Start()
		return fmt.Errorf("failed to chmod binary: %v", err)
	}

	// 6. Clear cached version
	m.version = ""

	// 7. Start Xray
	fmt.Printf("🚀 Starting Xray v%s...\n", version)
	if err := m.Start(); err != nil {
		// Restore backup on failure
		fmt.Printf("❌ Failed to start new version, restoring backup...\n")
		if _, statErr := os.Stat(backupPath); statErr == nil {
			copyFile(backupPath, binaryPath)
			os.Chmod(binaryPath, 0755)
		}
		m.Start()
		return fmt.Errorf("failed to start new version: %v", err)
	}

	fmt.Printf("✅ Xray switched to v%s successfully\n", version)
	return nil
}

// extractXrayFromZip extracts the xray binary from a zip file
func extractXrayFromZip(zipPath string) (string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", err
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == "xray" {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}
			defer rc.Close()

			tmpOut, err := os.CreateTemp("", "xray-bin-*")
			if err != nil {
				return "", err
			}

			if _, err := io.Copy(tmpOut, rc); err != nil {
				tmpOut.Close()
				os.Remove(tmpOut.Name())
				return "", err
			}
			tmpOut.Close()
			return tmpOut.Name(), nil
		}
	}

	return "", fmt.Errorf("xray binary not found in zip")
}

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

// ensureBaseConfig ensures a base Xray config file exists
func (m *XrayManager) ensureBaseConfig() error {
	if _, err := os.Stat(m.configPath); err == nil {
		return nil // Config already exists
	}

	config := m.buildBaseConfig(nil)
	return m.writeConfig(config)
}

// buildBaseConfig builds the base Xray configuration
func (m *XrayManager) buildBaseConfig(inbounds []InboundConfig) map[string]interface{} {
	config := map[string]interface{}{
		"log": map[string]interface{}{
			"loglevel": "warning",
		},
		"stats": map[string]interface{}{},
		"api": map[string]interface{}{
			"tag": "api",
			"services": []string{
				"HandlerService",
				"LoggerService",
				"StatsService",
			},
		},
		"policy": map[string]interface{}{
			"system": map[string]interface{}{
				"statsInboundUplink":   true,
				"statsInboundDownlink": true,
				"statsOutboundUplink":  true,
				"statsOutboundDownlink": true,
			},
		},
		"routing": map[string]interface{}{
			"rules": []map[string]interface{}{
				{
					"inboundTag":  []string{"api"},
					"outboundTag": "api",
					"type":        "field",
				},
			},
		},
		"outbounds": []map[string]interface{}{
			{
				"protocol": "freedom",
				"tag":      "direct",
			},
			{
				"protocol": "blackhole",
				"tag":      "blocked",
			},
		},
	}

	// Build inbounds array: always include gRPC API inbound
	allInbounds := []map[string]interface{}{
		{
			"listen":   "127.0.0.1",
			"port":     10085,
			"protocol": "dokodemo-door",
			"settings": map[string]interface{}{
				"address": "127.0.0.1",
			},
			"tag": "api",
		},
	}

	// Add user-defined inbounds
	if inbounds != nil {
		for _, ib := range inbounds {
			inboundObj := map[string]interface{}{
				"listen":   ib.Listen,
				"port":     ib.Port,
				"protocol": ib.Protocol,
				"tag":      ib.Tag,
			}

			// Parse settings JSON
			if ib.SettingsJSON != "" {
				var settings interface{}
				if err := json.Unmarshal([]byte(ib.SettingsJSON), &settings); err == nil {
					inboundObj["settings"] = settings
				}
			}

			// Parse stream settings JSON
			if ib.StreamSettingsJSON != "" {
				var streamSettings interface{}
				if err := json.Unmarshal([]byte(ib.StreamSettingsJSON), &streamSettings); err == nil {
					inboundObj["streamSettings"] = streamSettings
				}
			}

			// Parse sniffing JSON
			if ib.SniffingJSON != "" {
				var sniffing interface{}
				if err := json.Unmarshal([]byte(ib.SniffingJSON), &sniffing); err == nil {
					inboundObj["sniffing"] = sniffing
				}
			}

			allInbounds = append(allInbounds, inboundObj)
		}
	}

	config["inbounds"] = allInbounds
	return config
}

// ApplyConfig builds a full config with inbounds and restarts Xray
func (m *XrayManager) ApplyConfig(inbounds []InboundConfig) error {
	config := m.buildBaseConfig(inbounds)
	if err := m.writeConfig(config); err != nil {
		return fmt.Errorf("failed to write config: %v", err)
	}

	if m.IsRunning() {
		return m.Restart()
	}
	return m.Start()
}

// writeConfig writes the config to the config file
func (m *XrayManager) writeConfig(config map[string]interface{}) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}
	return os.WriteFile(m.configPath, data, 0644)
}

// InboundConfig represents an inbound configuration from the panel
type InboundConfig struct {
	Tag                string `json:"tag"`
	Protocol           string `json:"protocol"`
	Listen             string `json:"listen"`
	Port               int    `json:"port"`
	SettingsJSON       string `json:"settingsJson"`
	StreamSettingsJSON string `json:"streamSettingsJson"`
	SniffingJSON       string `json:"sniffingJson"`
}
