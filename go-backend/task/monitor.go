package task

import (
	"encoding/json"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"flux-panel/go-backend/service"
	"strconv"
	"strings"
	"sync"
	"time"
)

func StartLatencyMonitor() {
	go func() {
		// Wait for DB and WS to be ready
		time.Sleep(10 * time.Second)

		for {
			interval := getMonitorInterval()
			runLatencyCheck()
			time.Sleep(time.Duration(interval) * time.Second)
		}
	}()
}

func getMonitorInterval() int {
	var cfg model.ViteConfig
	if err := service.DB.Where("name = ?", "monitor_interval").First(&cfg).Error; err == nil {
		if v, err := strconv.Atoi(cfg.Value); err == nil && v > 0 {
			return v
		}
	}
	return 60
}

func runLatencyCheck() {
	if pkg.WS == nil {
		return
	}

	var forwards []model.Forward
	service.DB.Where("status = 1").Find(&forwards)

	if len(forwards) == 0 {
		return
	}

	now := time.Now().Unix()

	// Pre-load tunnels to avoid repeated DB queries
	tunnelMap := make(map[int64]*model.Tunnel)
	for _, f := range forwards {
		if _, ok := tunnelMap[f.TunnelId]; !ok {
			var tunnel model.Tunnel
			if err := service.DB.First(&tunnel, f.TunnelId).Error; err == nil {
				tunnelMap[f.TunnelId] = &tunnel
			}
		}
	}

	// Build check tasks
	type checkTask struct {
		forward model.Forward
		nodeId  int64
		addr    string
	}
	var tasks []checkTask
	for _, f := range forwards {
		tunnel, ok := tunnelMap[f.TunnelId]
		if !ok {
			continue
		}
		nodeId := tunnel.InNodeId
		if !pkg.WS.IsNodeOnline(nodeId) {
			continue
		}
		addrs := strings.Split(f.RemoteAddr, ",")
		for _, addr := range addrs {
			addr = strings.TrimSpace(addr)
			if addr == "" {
				continue
			}
			targetIp := extractIp(addr)
			targetPort := extractPort(addr)
			if targetIp == "" || targetPort <= 0 {
				continue
			}
			tasks = append(tasks, checkTask{forward: f, nodeId: nodeId, addr: addr})
		}
	}

	if len(tasks) == 0 {
		return
	}

	// Run checks concurrently with a concurrency limit
	concurrency := 10
	if len(tasks) < concurrency {
		concurrency = len(tasks)
	}
	var wg sync.WaitGroup
	sem := make(chan struct{}, concurrency)

	for _, t := range tasks {
		wg.Add(1)
		sem <- struct{}{}
		go func(ct checkTask) {
			defer wg.Done()
			defer func() { <-sem }()

			targetIp := extractIp(ct.addr)
			targetPort := extractPort(ct.addr)

			tcpPingData := map[string]interface{}{
				"ip":      targetIp,
				"port":    targetPort,
				"count":   2,
				"timeout": 3000,
			}

			result := pkg.WS.SendMsg(ct.nodeId, tcpPingData, "TcpPing")

			record := model.MonitorLatency{
				ForwardId:  ct.forward.ID,
				NodeId:     ct.nodeId,
				TargetAddr: ct.addr,
				Latency:    -1,
				Success:    false,
				RecordTime: now,
			}

			if result != nil && result.Msg == "OK" && result.Data != nil {
				dataBytes, err := json.Marshal(result.Data)
				if err == nil {
					var tcpPingResp struct {
						Success     bool    `json:"success"`
						AverageTime float64 `json:"averageTime"`
					}
					if json.Unmarshal(dataBytes, &tcpPingResp) == nil {
						record.Success = tcpPingResp.Success
						if tcpPingResp.Success {
							record.Latency = tcpPingResp.AverageTime
						}
					}
				}
			}

			service.DB.Create(&record)
		}(t)
	}
	wg.Wait()
}

func extractIp(address string) string {
	address = strings.TrimSpace(address)
	if address == "" {
		return ""
	}
	if strings.HasPrefix(address, "[") {
		closeBracket := strings.Index(address, "]")
		if closeBracket > 1 {
			return address[1:closeBracket]
		}
	}
	lastColon := strings.LastIndex(address, ":")
	if lastColon > 0 {
		return address[:lastColon]
	}
	return address
}

func extractPort(address string) int {
	address = strings.TrimSpace(address)
	if address == "" {
		return -1
	}
	if strings.HasPrefix(address, "[") {
		closeBracket := strings.Index(address, "]")
		if closeBracket > 1 && closeBracket+1 < len(address) && address[closeBracket+1] == ':' {
			portStr := address[closeBracket+2:]
			port, err := strconv.Atoi(portStr)
			if err != nil {
				return -1
			}
			return port
		}
	}
	lastColon := strings.LastIndex(address, ":")
	if lastColon > 0 && lastColon+1 < len(address) {
		port, err := strconv.Atoi(address[lastColon+1:])
		if err != nil {
			return -1
		}
		return port
	}
	return -1
}

