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
// Phases are skipped when the node has no relevant config (no forwards → skip 1+2, no inbounds → skip 4).
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

	// Check if node has any forwards (determines whether GOST phases are needed)
	var forwardCount int64
	DB.Model(&model.Forward{}).
		Joins("JOIN tunnel ON tunnel.id = forward.tunnel_id").
		Where("tunnel.in_node_id = ? OR tunnel.out_node_id = ?", nodeId, nodeId).
		Count(&forwardCount)

	if forwardCount > 0 {
		// Phase 1: Limiters (only needed when there are GOST services)
		reconcileLimiters(nodeId, &result)

		// Phase 2: GOST forwards
		reconcileForwards(nodeId, &result)
	} else {
		log.Printf("[Reconcile] 节点 %d 无转发规则，跳过 GOST 相关同步", nodeId)
	}

	// Phase 3: Xray inbounds (handles stop if no inbounds)
	reconcileXrayInbounds(nodeId, &result)

	// Phase 4: Xray certificates (only needed when there are inbounds)
	if result.Inbounds > 0 {
		reconcileXrayCerts(nodeId, &result)
	}

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

			// Use gentleSyncGostServices: Add-first, fallback to UpdateForwarder.
			// This avoids restarting listeners (which would kill active connections)
			// when services already exist on the node (e.g. after panel restart).
			errStr := gentleSyncGostServices(&fwd, &fwdTunnel, limiter, inNode, outNode, serviceName)
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

// gentleSyncGostServices uses Add-first strategy: try AddService first,
// if already exists → UpdateForwarder (hot update targets without restarting
// listeners, preserving active connections).
func gentleSyncGostServices(forward *model.Forward, tunnel *model.Tunnel, limiter *int,
	inNode *model.Node, outNode *model.Node, serviceName string) string {

	// === Tunnel forward: handle chain + remote service first ===
	if tunnel.Type == tunnelTypeTunnelForward {
		// Chain: Add, skip if already exists
		chainRemoteAddr := formatRemoteAddr(tunnel.OutIp, forward.OutPort)
		r := pkg.AddChains(inNode.ID, serviceName, chainRemoteAddr, tunnel.Protocol, tunnel.InterfaceName)
		if !isGostSuccess(r) && !strings.Contains(r.Msg, "already exists") {
			return r.Msg
		}

		// Remote service: Add, if exists → UpdateRemoteForwarder for hot update
		r = pkg.AddRemoteService(outNode.ID, serviceName, forward.OutPort,
			forward.RemoteAddr, tunnel.Protocol, forward.Strategy, forward.InterfaceName)
		if !isGostSuccess(r) {
			if strings.Contains(r.Msg, "already exists") {
				r = pkg.UpdateRemoteForwarder(outNode.ID, serviceName, forward.RemoteAddr, forward.Strategy)
				if r != nil && r.Msg != gostSuccessMsg {
					return r.Msg
				}
			} else {
				return r.Msg
			}
		}
	}

	// === Main service ===
	interfaceName := ""
	if tunnel.Type != tunnelTypeTunnelForward {
		interfaceName = forward.InterfaceName
	}

	r := pkg.AddService(inNode.ID, serviceName, forward.InPort, limiter,
		forward.RemoteAddr, tunnel.Type, tunnel, forward.Strategy, interfaceName)
	if !isGostSuccess(r) {
		if strings.Contains(r.Msg, "already exists") {
			// Port forward: hot update forwarder (target/strategy), listener stays running
			if tunnel.Type == tunnelTypePortForward {
				r = pkg.UpdateForwarder(inNode.ID, serviceName, forward.RemoteAddr, forward.Strategy)
				if r != nil && r.Msg != gostSuccessMsg {
					return r.Msg
				}
			}
			// Tunnel forward main service (relay) doesn't support Forward() interface, skip
		} else {
			return r.Msg
		}
	}

	return ""
}

// ---------------------------------------------------------------------------
// Phase 3 — Xray inbounds
// ---------------------------------------------------------------------------

func reconcileXrayInbounds(nodeId int64, result *ReconcileResult) {
	var inbounds []model.XrayInbound
	DB.Where("node_id = ? AND enable = 1", nodeId).Find(&inbounds)

	if len(inbounds) == 0 {
		// No inbounds — stop Xray if it's running (e.g. stale from before inbounds were deleted)
		log.Printf("[Reconcile] 节点 %d 无启用的 Xray 入站，停止 Xray", nodeId)
		pkg.XrayStop(nodeId)
		return
	}

	// Merge clients into settingsJson before sending to node
	for i := range inbounds {
		inbounds[i].SettingsJson = mergeClientsIntoSettings(&inbounds[i])
	}

	// Strategy: try hot-add first inbound via gRPC. If it fails with a
	// connection/dial error, Xray isn't running → fall back to ApplyConfig.
	// If it succeeds or returns "already exists", Xray is running → continue hot-add.
	// IMPORTANT: only fall back to ApplyConfig for clear "not running" signals.
	// Broad matches like "failed" or "超时" would cause false positives and
	// unnecessarily restart Xray (breaking active connections).
	firstResult := pkg.XrayAddInbound(nodeId, &inbounds[0])
	firstMsg := ""
	if firstResult != nil {
		firstMsg = firstResult.Msg
	}

	xrayNotRunning := firstResult == nil ||
		strings.Contains(firstMsg, "not running") ||
		strings.Contains(firstMsg, "connection refused") ||
		(strings.Contains(firstMsg, "dial") && strings.Contains(firstMsg, "10085"))

	if xrayNotRunning {
		// Xray not running — use ApplyConfig to write config and start the process
		log.Printf("[Reconcile] 节点 %d Xray 未运行 (%s)，使用 ApplyConfig 启动", nodeId, firstMsg)
		r := pkg.XrayApplyConfig(nodeId, inbounds)
		if r != nil && r.Msg != gostSuccessMsg {
			result.Errors = append(result.Errors, fmt.Sprintf("Xray ApplyConfig: %s", r.Msg))
		}
		result.Inbounds = len(inbounds)
		return
	}

	// First inbound succeeded (or already exists) — Xray is running.
	// Hot-add remaining inbounds.
	if firstMsg != gostSuccessMsg {
		log.Printf("[Reconcile] Xray inbound %s: %s (跳过)", inbounds[0].Tag, firstMsg)
	}
	result.Inbounds++

	for _, ib := range inbounds[1:] {
		r := pkg.XrayAddInbound(nodeId, &ib)
		if r != nil && r.Msg != gostSuccessMsg {
			log.Printf("[Reconcile] Xray inbound %s: %s (跳过)", ib.Tag, r.Msg)
		}
		result.Inbounds++
	}
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
