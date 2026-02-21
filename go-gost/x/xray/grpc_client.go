package xray

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// XrayGrpcClient provides communication with Xray-core via CLI
type XrayGrpcClient struct {
	addr       string
	binaryPath string
}

// NewXrayGrpcClient creates a new gRPC client
func NewXrayGrpcClient(addr string, binaryPaths ...string) *XrayGrpcClient {
	bp := "xray"
	if len(binaryPaths) > 0 && binaryPaths[0] != "" {
		bp = binaryPaths[0]
	}
	return &XrayGrpcClient{addr: addr, binaryPath: bp}
}

// AddUser adds a user to an inbound via Xray API CLI command.
// Requires Xray v25.7.26+ (adu command). Returns error on older versions.
func (c *XrayGrpcClient) AddUser(inboundTag, email, uuidOrPassword, flow, protocol string, alterId int) error {
	clientObj := map[string]interface{}{"email": email, "level": 0}
	switch protocol {
	case "vmess":
		clientObj["id"] = uuidOrPassword
		clientObj["alterId"] = alterId
	case "vless":
		clientObj["id"] = uuidOrPassword
		clientObj["flow"] = flow
	case "trojan":
		clientObj["password"] = uuidOrPassword
	case "shadowsocks":
		clientObj["password"] = uuidOrPassword
	default:
		return fmt.Errorf("unsupported protocol: %s", protocol)
	}

	// adu expects a JSON file in InboundDetourConfig format: {tag, settings: {clients: [...]}}
	config := map[string]interface{}{
		"tag": inboundTag,
		"settings": map[string]interface{}{
			"clients": []interface{}{clientObj},
		},
	}
	configData, _ := json.Marshal(config)

	tmpFile, err := os.CreateTemp("", "xray-adu-*.json")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.Write(configData)
	tmpFile.Close()

	fmt.Printf("📡 Xray gRPC addUser: tag=%s email=%s\n", inboundTag, email)
	cmd := exec.Command(c.binaryPath, "api", "adu",
		"--server="+c.addr, tmpFile.Name())
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("xray api adu failed: %v, output: %s", err, string(output))
	}
	return nil
}

// RemoveUser removes a user from an inbound via Xray API CLI command.
// Requires Xray v25.7.26+ (rmu command). Returns error on older versions.
func (c *XrayGrpcClient) RemoveUser(inboundTag, email string) error {
	fmt.Printf("📡 Xray gRPC removeUser: tag=%s email=%s\n", inboundTag, email)
	cmd := exec.Command(c.binaryPath, "api", "rmu",
		"--server="+c.addr, "-tag="+inboundTag, email)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("xray api rmu failed: %v, output: %s", err, string(output))
	}
	return nil
}

// AddInbound adds an inbound to a running Xray instance via gRPC API
func (c *XrayGrpcClient) AddInbound(configJSON string) error {
	fmt.Printf("📡 Xray gRPC addInbound\n")

	// adi expects a JSON file path as positional argument
	tmpFile, err := os.CreateTemp("", "xray-adi-*.json")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString(configJSON)
	tmpFile.Close()

	cmd := exec.Command(c.binaryPath, "api", "adi",
		"--server="+c.addr, tmpFile.Name())
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("xray api adi failed: %v, output: %s", err, string(output))
	}
	return nil
}

// RemoveInbound removes an inbound from a running Xray instance via gRPC API
func (c *XrayGrpcClient) RemoveInbound(tag string) error {
	fmt.Printf("📡 Xray gRPC removeInbound: tag=%s\n", tag)
	cmd := exec.Command(c.binaryPath, "api", "rmi",
		"--server="+c.addr, tag)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("xray api rmi failed: %v, output: %s", err, string(output))
	}
	return nil
}

// TrafficStat represents traffic statistics for one user
type TrafficStat struct {
	Email    string `json:"email"`
	Uplink   int64  `json:"u"`
	Downlink int64  `json:"d"`
}

// QueryTraffic queries traffic stats for all users via xray api statsquery CLI.
// When reset=true, counters are reset after reading (incremental stats).
func (c *XrayGrpcClient) QueryTraffic(reset bool) ([]TrafficStat, error) {
	args := []string{"api", "statsquery", "-s", c.addr, "-pattern", "user"}
	if reset {
		args = append(args, "-reset")
	}

	cmd := exec.Command(c.binaryPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("xray api statsquery failed: %v, output: %s", err, string(output))
	}

	return parseStatsOutput(string(output)), nil
}

// statsQueryJSON represents the JSON output from `xray api statsquery`.
// Example:
//
//	{
//	  "stat": [
//	    {"name": "user>>>email@test.com>>>traffic>>>uplink", "value": 12345},
//	    {"name": "user>>>email@test.com>>>traffic>>>downlink", "value": 67890}
//	  ]
//	}
type statsQueryJSON struct {
	Stat []struct {
		Name  string `json:"name"`
		Value int64  `json:"value"`
	} `json:"stat"`
}

// parseStatsOutput tries JSON parsing first, then falls back to text-proto.
func parseStatsOutput(output string) []TrafficStat {
	output = strings.TrimSpace(output)
	if output == "" {
		return nil
	}

	// Try JSON format (Xray-core modern versions)
	var jsonResult statsQueryJSON
	if err := json.Unmarshal([]byte(output), &jsonResult); err == nil && len(jsonResult.Stat) > 0 {
		return extractUserStats(jsonResult)
	}

	return nil
}

// extractUserStats extracts per-user traffic stats from parsed JSON.
func extractUserStats(result statsQueryJSON) []TrafficStat {
	trafficMap := make(map[string]*TrafficStat)

	for _, s := range result.Stat {
		// Parse: user>>>{email}>>>traffic>>>uplink|downlink
		parts := strings.Split(s.Name, ">>>")
		if len(parts) >= 4 && parts[0] == "user" {
			email := parts[1]
			direction := parts[3]

			if _, ok := trafficMap[email]; !ok {
				trafficMap[email] = &TrafficStat{Email: email}
			}

			switch direction {
			case "uplink":
				trafficMap[email].Uplink = s.Value
			case "downlink":
				trafficMap[email].Downlink = s.Value
			}
		}
	}

	result2 := make([]TrafficStat, 0, len(trafficMap))
	for _, stat := range trafficMap {
		if stat.Uplink > 0 || stat.Downlink > 0 {
			result2 = append(result2, *stat)
		}
	}
	return result2
}
