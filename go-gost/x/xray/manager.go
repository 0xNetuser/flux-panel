package xray

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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

// GetVersion returns the Xray version
func (m *XrayManager) GetVersion() string {
	if m.version != "" {
		return m.version
	}

	cmd := exec.Command(m.binaryPath, "version")
	output, err := cmd.Output()
	if err != nil {
		return "unknown"
	}

	m.version = string(output)
	return m.version
}

// GetGrpcAddr returns the gRPC address
func (m *XrayManager) GetGrpcAddr() string {
	return m.grpcAddr
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
