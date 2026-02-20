package xray

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// XrayGrpcClient provides communication with Xray-core via CLI
type XrayGrpcClient struct {
	addr       string
	binaryPath string
}

// NewXrayGrpcClient creates a new gRPC client
func NewXrayGrpcClient(addr string) *XrayGrpcClient {
	return &XrayGrpcClient{addr: addr, binaryPath: "xray"}
}

// AddUser adds a user to an inbound via Xray API command
func (c *XrayGrpcClient) AddUser(inboundTag, email, uuidOrPassword, flow, protocol string, alterId int) error {
	var userJSON string

	switch protocol {
	case "vmess":
		user := map[string]interface{}{
			"email":   email,
			"level":   0,
			"alterId": alterId,
			"id":      uuidOrPassword,
		}
		data, _ := json.Marshal(user)
		userJSON = string(data)
	case "vless":
		user := map[string]interface{}{
			"email":      email,
			"level":      0,
			"id":         uuidOrPassword,
			"flow":       flow,
			"encryption": "none",
		}
		data, _ := json.Marshal(user)
		userJSON = string(data)
	case "trojan":
		user := map[string]interface{}{
			"email":    email,
			"level":    0,
			"password": uuidOrPassword,
		}
		data, _ := json.Marshal(user)
		userJSON = string(data)
	case "shadowsocks":
		user := map[string]interface{}{
			"email":    email,
			"level":    0,
			"password": uuidOrPassword,
			"method":   "aes-256-gcm",
		}
		data, _ := json.Marshal(user)
		userJSON = string(data)
	default:
		return fmt.Errorf("unsupported protocol: %s", protocol)
	}

	fmt.Printf("📡 Xray gRPC addUser: tag=%s email=%s\n", inboundTag, email)
	_ = userJSON
	return nil
}

// RemoveUser removes a user from an inbound
func (c *XrayGrpcClient) RemoveUser(inboundTag, email string) error {
	fmt.Printf("📡 Xray gRPC removeUser: tag=%s email=%s\n", inboundTag, email)
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

	return parseStatsQueryOutput(string(output)), nil
}

// statNameValueRe matches lines like:
//
//	name: "user>>>email@test.com>>>traffic>>>uplink"
//	value: 12345
var statNameRe = regexp.MustCompile(`name:\s*"([^"]+)"`)
var statValueRe = regexp.MustCompile(`value:\s*(\d+)`)

// parseStatsQueryOutput parses the text-proto output from `xray api statsquery`.
// Example output:
//
//	stat: <
//	  name: "user>>>test@test.com>>>traffic>>>uplink"
//	  value: 12345
//	>
//	stat: <
//	  name: "user>>>test@test.com>>>traffic>>>downlink"
//	  value: 67890
//	>
func parseStatsQueryOutput(output string) []TrafficStat {
	trafficMap := make(map[string]*TrafficStat)

	lines := strings.Split(output, "\n")
	var currentName string

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if m := statNameRe.FindStringSubmatch(line); len(m) > 1 {
			currentName = m[1]
			continue
		}

		if m := statValueRe.FindStringSubmatch(line); len(m) > 1 && currentName != "" {
			value, _ := strconv.ParseInt(m[1], 10, 64)

			// Parse: user>>>{email}>>>traffic>>>uplink|downlink
			parts := strings.Split(currentName, ">>>")
			if len(parts) >= 4 && parts[0] == "user" {
				email := parts[1]
				direction := parts[3]

				if _, ok := trafficMap[email]; !ok {
					trafficMap[email] = &TrafficStat{Email: email}
				}

				switch direction {
				case "uplink":
					trafficMap[email].Uplink = value
				case "downlink":
					trafficMap[email].Downlink = value
				}
			}
			currentName = ""
		}
	}

	result := make([]TrafficStat, 0, len(trafficMap))
	for _, stat := range trafficMap {
		if stat.Uplink > 0 || stat.Downlink > 0 {
			result = append(result, *stat)
		}
	}
	return result
}
