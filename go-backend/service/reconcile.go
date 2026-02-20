package service

import (
	"fmt"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"strings"
	"sync"
	"time"
)

// Per-node reconcile lock
var reconcileLocks sync.Map

// ReconcileResult holds the summary of a reconciliation run.
type ReconcileResult struct {
	NodeId   int64    `json:"nodeId"`
	Limiters int      `json:"limiters"`
	Forwards int      `json:"forwards"`
	Inbounds int      `json:"inbounds"`
	Certs    int      `json:"certs"`
	Errors   []string `json:"errors,omitempty"`
	Duration int64    `json:"duration"`
}

func getNodeLock(nodeId int64) *sync.Mutex {
	val, _ := reconcileLocks.LoadOrStore(nodeId, &sync.Mutex{})
	return val.(*sync.Mutex)
}

// ReconcileNode synchronises panel DB state to a node in 4 phases:
// 1. Limiters  2. GOST forwards  3. Xray inbounds  4. Xray certificates
func ReconcileNode(nodeId int64) ReconcileResult {
	result := ReconcileResult{NodeId: nodeId}
	start := time.Now()

	mu := getNodeLock(nodeId)
	if !mu.TryLock() {
		result.Errors = append(result.Errors, "另一个同步任务正在执行")
		return result
	}
	defer mu.Unlock()

	log.Printf("[Reconcile] 开始同步节点 %d 配置", nodeId)

	// Phase 1: Limiters
	reconcileLimiters(nodeId, &result)

	// Phase 2: GOST forwards
	reconcileForwards(nodeId, &result)

	// Phase 3: Xray inbounds
	reconcileXrayInbounds(nodeId, &result)

	// Phase 4: Xray certificates
	reconcileXrayCerts(nodeId, &result)

	result.Duration = time.Since(start).Milliseconds()
	log.Printf("[Reconcile] 节点 %d 同步完成: 限速器=%d 转发=%d 入站=%d 证书=%d 耗时=%dms 错误=%d",
		nodeId, result.Limiters, result.Forwards, result.Inbounds, result.Certs, result.Duration, len(result.Errors))

	return result
}

// ---------------------------------------------------------------------------
// Phase 1 — Limiters
// ---------------------------------------------------------------------------

func reconcileLimiters(nodeId int64, result *ReconcileResult) {
	var tunnels []model.Tunnel
	DB.Where("in_node_id = ?", nodeId).Find(&tunnels)

	seen := make(map[int64]bool)
	for _, tunnel := range tunnels {
		var userTunnels []model.UserTunnel
		DB.Where("tunnel_id = ? AND speed_id IS NOT NULL AND speed_id > 0", tunnel.ID).Find(&userTunnels)

		for _, ut := range userTunnels {
			if ut.SpeedId == nil || *ut.SpeedId <= 0 {
				continue
			}
			if seen[*ut.SpeedId] {
				continue
			}
			seen[*ut.SpeedId] = true

			var speedLimit model.SpeedLimit
			if err := DB.First(&speedLimit, *ut.SpeedId).Error; err != nil {
				continue
			}
			speed := fmt.Sprintf("%d", speedLimit.Speed)
			r := pkg.AddLimiters(nodeId, *ut.SpeedId, speed)
			if r != nil && r.Msg != "OK" {
				result.Errors = append(result.Errors, fmt.Sprintf("限速器 %d: %s", *ut.SpeedId, r.Msg))
			}
			result.Limiters++
		}
	}
}

// ---------------------------------------------------------------------------
// Phase 2 — GOST forwards
// ---------------------------------------------------------------------------

func reconcileForwards(nodeId int64, result *ReconcileResult) {
	var tunnels []model.Tunnel
	DB.Where("in_node_id = ? OR out_node_id = ?", nodeId, nodeId).Find(&tunnels)

	for _, tunnel := range tunnels {
		var forwards []model.Forward
		DB.Where("tunnel_id = ?", tunnel.ID).Find(&forwards)

		inNode, outNode, errMsg := getRequiredNodes(&tunnel)
		if errMsg != "" {
			result.Errors = append(result.Errors, fmt.Sprintf("隧道 %d 节点错误: %s", tunnel.ID, errMsg))
			continue
		}

		for _, fwd := range forwards {
			// Override tunnel listen address if forward has custom listenIp
			fwdTunnel := tunnel
			if fwd.ListenIp != "" {
				fwdTunnel.TcpListenAddr = fwd.ListenIp
				fwdTunnel.UdpListenAddr = fwd.ListenIp
			}

			userTunnel := getUserTunnel(fwd.UserId, fwd.TunnelId)
			serviceName := buildServiceName(fwd.ID, fwd.UserId, userTunnel)

			// Determine limiter
			var limiter *int
			if userTunnel != nil && userTunnel.SpeedId != nil && *userTunnel.SpeedId > 0 {
				v := int(*userTunnel.SpeedId)
				limiter = &v
			}

			errStr := updateGostServices(&fwd, &fwdTunnel, limiter, inNode, outNode, serviceName)
			if errStr != "" {
				result.Errors = append(result.Errors, fmt.Sprintf("转发 %d: %s", fwd.ID, errStr))
			}
			result.Forwards++

			// If forward is paused, ensure it stays paused on this node
			if fwd.Status == forwardStatusPaused {
				if tunnel.InNodeId == nodeId {
					if fwd.ListenIp != "" && strings.Contains(fwd.ListenIp, ",") {
						pkg.PauseServiceMultiIP(nodeId, serviceName, fwd.ListenIp)
					} else {
						pkg.PauseService(nodeId, serviceName)
					}
				}
				if tunnel.Type == tunnelTypeTunnelForward && tunnel.OutNodeId == nodeId && outNode != nil {
					pkg.PauseRemoteService(nodeId, serviceName)
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Phase 3 — Xray inbounds
// ---------------------------------------------------------------------------

func reconcileXrayInbounds(nodeId int64, result *ReconcileResult) {
	var inbounds []model.XrayInbound
	DB.Where("node_id = ? AND enable = 1", nodeId).Find(&inbounds)

	// Merge clients into settingsJson before sending to node
	for i := range inbounds {
		inbounds[i].SettingsJson = mergeClientsIntoSettings(&inbounds[i])
	}

	r := pkg.XrayApplyConfig(nodeId, inbounds)
	if r != nil && r.Msg != "OK" {
		result.Errors = append(result.Errors, fmt.Sprintf("Xray 入站: %s", r.Msg))
	}
	result.Inbounds = len(inbounds)
}

// ---------------------------------------------------------------------------
// Phase 4 — Xray certificates
// ---------------------------------------------------------------------------

func reconcileXrayCerts(nodeId int64, result *ReconcileResult) {
	var certs []model.XrayTlsCert
	DB.Where("node_id = ?", nodeId).Find(&certs)

	for _, cert := range certs {
		if cert.PublicKey == "" || cert.PrivateKey == "" {
			continue
		}
		r := pkg.XrayDeployCert(nodeId, cert.Domain, cert.PublicKey, cert.PrivateKey)
		if r != nil && r.Msg != "OK" {
			result.Errors = append(result.Errors, fmt.Sprintf("证书 %s: %s", cert.Domain, r.Msg))
		}
		result.Certs++
	}
}

// ---------------------------------------------------------------------------
// API wrapper
// ---------------------------------------------------------------------------

// ReconcileNodeAPI is the synchronous API wrapper for handlers.
func ReconcileNodeAPI(nodeId int64) dto.R {
	node := GetNodeById(nodeId)
	if node == nil {
		return dto.Err("节点不存在")
	}
	result := ReconcileNode(nodeId)
	return dto.Ok(result)
}
