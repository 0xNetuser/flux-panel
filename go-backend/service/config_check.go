package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"fmt"
	"log"
	"strconv"
	"strings"
)

func CleanNodeConfigs(nodeIdStr string, gostConfig dto.GostConfigDto) {
	nodeId, err := strconv.ParseInt(nodeIdStr, 10, 64)
	if err != nil {
		return
	}

	// Get all tunnels that use this node as inNode or outNode
	var tunnels []model.Tunnel
	DB.Where("in_node_id = ? OR out_node_id = ?", nodeId, nodeId).Find(&tunnels)

	// Build set of valid service names, chain names, and limiter names
	validServices := make(map[string]bool)
	validChains := make(map[string]bool)
	validLimiters := make(map[string]bool)

	for _, tunnel := range tunnels {
		var forwards []model.Forward
		DB.Where("tunnel_id = ?", tunnel.ID).Find(&forwards)

		for _, fwd := range forwards {
			// Get user tunnel for service name
			var ut model.UserTunnel
			utId := int64(0)
			if err := DB.Where("user_id = ? AND tunnel_id = ?", fwd.UserId, fwd.TunnelId).First(&ut).Error; err == nil {
				utId = ut.ID
			}

			serviceName := strconv.FormatInt(fwd.ID, 10) + "_" + strconv.FormatInt(fwd.UserId, 10) + "_" + strconv.FormatInt(utId, 10)

			if tunnel.InNodeId == nodeId {
				if fwd.ListenIp != "" && strings.Contains(fwd.ListenIp, ",") {
					ips := strings.Split(fwd.ListenIp, ",")
					for i := range ips {
						suffix := fmt.Sprintf("_%d", i)
						validServices[serviceName+suffix+"_tcp"] = true
						validServices[serviceName+suffix+"_udp"] = true
					}
				} else {
					validServices[serviceName+"_tcp"] = true
					validServices[serviceName+"_udp"] = true
				}
				if tunnel.Type == 2 {
					validChains[serviceName+"_chains"] = true
				}
			}
			if tunnel.OutNodeId == nodeId && tunnel.Type == 2 {
				validServices[serviceName+"_tls"] = true
			}

			// Limiter
			if ut.SpeedId != nil && *ut.SpeedId > 0 {
				validLimiters[strconv.FormatInt(*ut.SpeedId, 10)] = true
			}
		}
	}

	// Clean orphaned services
	for _, svc := range gostConfig.Services {
		if !validServices[svc.Name] {
			log.Printf("清理孤儿服务: %s on node %d", svc.Name, nodeId)
			// Determine if it's a single service or tcp/udp pair
			if strings.HasSuffix(svc.Name, "_tls") {
				baseName := strings.TrimSuffix(svc.Name, "_tls")
				pkg.DeleteRemoteService(nodeId, baseName)
			} else if strings.HasSuffix(svc.Name, "_tcp") || strings.HasSuffix(svc.Name, "_udp") {
				baseName := svc.Name[:len(svc.Name)-4]
				pkg.DeleteService(nodeId, baseName)
			}
		}
	}

	// Clean orphaned chains
	for _, chain := range gostConfig.Chains {
		if !validChains[chain.Name] {
			log.Printf("清理孤儿链: %s on node %d", chain.Name, nodeId)
			baseName := strings.TrimSuffix(chain.Name, "_chains")
			pkg.DeleteChains(nodeId, baseName)
		}
	}

	// Clean orphaned limiters
	for _, limiter := range gostConfig.Limiters {
		if !validLimiters[limiter.Name] {
			log.Printf("清理孤儿限速器: %s on node %d", limiter.Name, nodeId)
			limiterId, err := strconv.ParseInt(limiter.Name, 10, 64)
			if err == nil {
				pkg.DeleteLimiters(nodeId, limiterId)
			}
		}
	}
}
