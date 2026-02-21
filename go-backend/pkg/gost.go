package pkg

import (
	"fmt"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"strings"
)

func AddLimiters(nodeId int64, name int64, speed string) *dto.GostResponse {
	data := createLimiterData(name, speed)
	return WS.SendMsg(nodeId, data, "AddLimiters")
}

func UpdateLimiters(nodeId int64, name int64, speed string) *dto.GostResponse {
	data := createLimiterData(name, speed)
	req := map[string]interface{}{
		"limiter": fmt.Sprintf("%d", name),
		"data":    data,
	}
	return WS.SendMsg(nodeId, req, "UpdateLimiters")
}

func DeleteLimiters(nodeId int64, name int64) *dto.GostResponse {
	req := map[string]interface{}{
		"limiter": fmt.Sprintf("%d", name),
	}
	return WS.SendMsg(nodeId, req, "DeleteLimiters")
}

func AddService(nodeId int64, name string, inPort int, limiter *int, remoteAddr string, fwdType int, tunnel *model.Tunnel, strategy string, interfaceName string) *dto.GostResponse {
	services := buildServices(name, inPort, limiter, remoteAddr, fwdType, tunnel, strategy, interfaceName)
	return WS.SendMsg(nodeId, services, "AddService")
}

func UpdateService(nodeId int64, name string, inPort int, limiter *int, remoteAddr string, fwdType int, tunnel *model.Tunnel, strategy string, interfaceName string) *dto.GostResponse {
	services := buildServices(name, inPort, limiter, remoteAddr, fwdType, tunnel, strategy, interfaceName)
	return WS.SendMsg(nodeId, services, "UpdateService")
}

// UpdateForwarder hot-updates only the forwarder (target addresses/strategy) on existing services
// without restarting the listener. Existing connections are not interrupted.
func UpdateForwarder(nodeId int64, name string, remoteAddr string, strategy string) *dto.GostResponse {
	forwarder := buildForwarder(remoteAddr, strategy)
	var services []map[string]interface{}
	for _, proto := range []string{"tcp", "udp"} {
		services = append(services, map[string]interface{}{
			"name":      name + "_" + proto,
			"forwarder": forwarder,
		})
	}
	data := map[string]interface{}{
		"services": services,
	}
	return WS.SendMsg(nodeId, data, "UpdateForwarder")
}

// UpdateRemoteForwarder hot-updates the forwarder on a remote (relay) service (_tls suffix).
func UpdateRemoteForwarder(nodeId int64, name string, remoteAddr string, strategy string) *dto.GostResponse {
	forwarder := buildForwarder(remoteAddr, strategy)
	data := map[string]interface{}{
		"services": []map[string]interface{}{
			{
				"name":      name + "_tls",
				"forwarder": forwarder,
			},
		},
	}
	return WS.SendMsg(nodeId, data, "UpdateForwarder")
}

func DeleteService(nodeId int64, name string) *dto.GostResponse {
	data := map[string]interface{}{
		"services": []string{name + "_tcp", name + "_udp"},
	}
	return WS.SendMsg(nodeId, data, "DeleteService")
}

// DeleteServiceMultiIP deletes all services for a multi-IP listen configuration.
func DeleteServiceMultiIP(nodeId int64, name string, listenIp string) *dto.GostResponse {
	names := buildMultiIPServiceNames(name, listenIp)
	data := map[string]interface{}{
		"services": names,
	}
	return WS.SendMsg(nodeId, data, "DeleteService")
}

func AddRemoteService(nodeId int64, name string, outPort int, remoteAddr string, protocol string, strategy string, interfaceName string) *dto.GostResponse {
	service := buildRemoteService(name, outPort, remoteAddr, protocol, strategy, interfaceName)
	return WS.SendMsg(nodeId, []interface{}{service}, "AddService")
}

func UpdateRemoteService(nodeId int64, name string, outPort int, remoteAddr string, protocol string, strategy string, interfaceName string) *dto.GostResponse {
	service := buildRemoteService(name, outPort, remoteAddr, protocol, strategy, interfaceName)
	return WS.SendMsg(nodeId, []interface{}{service}, "UpdateService")
}

func DeleteRemoteService(nodeId int64, name string) *dto.GostResponse {
	req := map[string]interface{}{
		"services": []string{name + "_tls"},
	}
	return WS.SendMsg(nodeId, req, "DeleteService")
}

func PauseService(nodeId int64, name string) *dto.GostResponse {
	data := map[string]interface{}{
		"services": []string{name + "_tcp", name + "_udp"},
	}
	return WS.SendMsg(nodeId, data, "PauseService")
}

func ResumeService(nodeId int64, name string) *dto.GostResponse {
	data := map[string]interface{}{
		"services": []string{name + "_tcp", name + "_udp"},
	}
	return WS.SendMsg(nodeId, data, "ResumeService")
}

// PauseServiceMultiIP pauses all services for a multi-IP listen configuration.
func PauseServiceMultiIP(nodeId int64, name string, listenIp string) *dto.GostResponse {
	names := buildMultiIPServiceNames(name, listenIp)
	data := map[string]interface{}{
		"services": names,
	}
	return WS.SendMsg(nodeId, data, "PauseService")
}

// ResumeServiceMultiIP resumes all services for a multi-IP listen configuration.
func ResumeServiceMultiIP(nodeId int64, name string, listenIp string) *dto.GostResponse {
	names := buildMultiIPServiceNames(name, listenIp)
	data := map[string]interface{}{
		"services": names,
	}
	return WS.SendMsg(nodeId, data, "ResumeService")
}

func PauseRemoteService(nodeId int64, name string) *dto.GostResponse {
	data := map[string]interface{}{
		"services": []string{name + "_tls"},
	}
	return WS.SendMsg(nodeId, data, "PauseService")
}

func ResumeRemoteService(nodeId int64, name string) *dto.GostResponse {
	data := map[string]interface{}{
		"services": []string{name + "_tls"},
	}
	return WS.SendMsg(nodeId, data, "ResumeService")
}

func NodeUpdateBinary(nodeId int64, panelAddr string) *dto.GostResponse {
	data := map[string]interface{}{"panelAddr": panelAddr}
	return WS.SendMsg(nodeId, data, "NodeUpdateBinary")
}

func AddChains(nodeId int64, name string, remoteAddr string, protocol string, interfaceName string) *dto.GostResponse {
	data := buildChainData(name, remoteAddr, protocol, interfaceName)
	return WS.SendMsg(nodeId, data, "AddChains")
}

func UpdateChains(nodeId int64, name string, remoteAddr string, protocol string, interfaceName string) *dto.GostResponse {
	data := buildChainData(name, remoteAddr, protocol, interfaceName)
	req := map[string]interface{}{
		"chain": name + "_chains",
		"data":  data,
	}
	return WS.SendMsg(nodeId, req, "UpdateChains")
}

func DeleteChains(nodeId int64, name string) *dto.GostResponse {
	data := map[string]interface{}{
		"chain": name + "_chains",
	}
	return WS.SendMsg(nodeId, data, "DeleteChains")
}

// --- internal builders ---

func createLimiterData(name int64, speed string) map[string]interface{} {
	return map[string]interface{}{
		"name":   fmt.Sprintf("%d", name),
		"limits": []string{fmt.Sprintf("$ %sMB %sMB", speed, speed)},
	}
}

func buildServices(name string, inPort int, limiter *int, remoteAddr string, fwdType int, tunnel *model.Tunnel, strategy string, interfaceName string) []interface{} {
	// Check if listen address contains multiple IPs (comma-separated)
	listenIps := splitListenIPs(tunnel.TcpListenAddr)
	if len(listenIps) <= 1 {
		// Single IP (or default) — no suffix, keep existing behavior
		var services []interface{}
		for _, proto := range []string{"tcp", "udp"} {
			svc := buildServiceConfig(name, inPort, limiter, remoteAddr, proto, fwdType, tunnel, strategy, interfaceName)
			services = append(services, svc)
		}
		return services
	}

	// Multiple IPs — generate service group per IP with _N suffix
	var services []interface{}
	for i, ip := range listenIps {
		ip = strings.TrimSpace(ip)
		suffixedName := fmt.Sprintf("%s_%d", name, i)
		for _, proto := range []string{"tcp", "udp"} {
			svc := buildServiceConfigWithIP(suffixedName, inPort, limiter, remoteAddr, proto, fwdType, tunnel, strategy, interfaceName, ip)
			services = append(services, svc)
		}
	}
	return services
}

// splitListenIPs splits a comma-separated listen IP string into individual IPs.
// Returns a single-element slice for non-comma values (including empty string).
func splitListenIPs(listenAddr string) []string {
	if !strings.Contains(listenAddr, ",") {
		return []string{listenAddr}
	}
	parts := strings.Split(listenAddr, ",")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	if len(result) == 0 {
		return []string{listenAddr}
	}
	return result
}

// buildMultiIPServiceNames generates the list of all service names for a multi-IP configuration.
func buildMultiIPServiceNames(name string, listenIp string) []string {
	ips := splitListenIPs(listenIp)
	if len(ips) <= 1 {
		return []string{name + "_tcp", name + "_udp"}
	}
	var names []string
	for i := range ips {
		suffixed := fmt.Sprintf("%s_%d", name, i)
		names = append(names, suffixed+"_tcp", suffixed+"_udp")
	}
	return names
}

func buildServiceConfig(name string, inPort int, limiter *int, remoteAddr string, protocol string, fwdType int, tunnel *model.Tunnel, strategy string, interfaceName string) map[string]interface{} {
	svc := map[string]interface{}{
		"name": name + "_" + protocol,
	}

	if protocol == "tcp" {
		svc["addr"] = formatListenAddr(tunnel.TcpListenAddr, inPort)
	} else {
		svc["addr"] = formatListenAddr(tunnel.UdpListenAddr, inPort)
	}

	if interfaceName != "" {
		svc["metadata"] = map[string]interface{}{"interface": interfaceName}
	}

	if limiter != nil {
		svc["limiter"] = fmt.Sprintf("%d", *limiter)
	}

	handler := map[string]interface{}{"type": protocol}
	if fwdType != 1 {
		handler["chain"] = name + "_chains"
	}
	svc["handler"] = handler

	listener := map[string]interface{}{"type": protocol}
	if protocol == "udp" {
		listener["metadata"] = map[string]interface{}{"keepAlive": true}
	}
	svc["listener"] = listener

	if fwdType == 1 {
		svc["forwarder"] = buildForwarder(remoteAddr, strategy)
	}

	return svc
}

// buildServiceConfigWithIP is like buildServiceConfig but uses an explicit listen IP instead of the tunnel's.
func buildServiceConfigWithIP(name string, inPort int, limiter *int, remoteAddr string, protocol string, fwdType int, tunnel *model.Tunnel, strategy string, interfaceName string, listenIp string) map[string]interface{} {
	svc := map[string]interface{}{
		"name": name + "_" + protocol,
		"addr": formatListenAddr(listenIp, inPort),
	}

	if interfaceName != "" {
		svc["metadata"] = map[string]interface{}{"interface": interfaceName}
	}

	if limiter != nil {
		svc["limiter"] = fmt.Sprintf("%d", *limiter)
	}

	handler := map[string]interface{}{"type": protocol}
	if fwdType != 1 {
		// For multi-IP, the chain name is based on the original (non-suffixed) name
		// We need to strip the _N suffix to get the original chain name
		chainName := name
		if idx := strings.LastIndex(name, "_"); idx > 0 {
			// Check if the suffix is a number (multi-IP suffix)
			suffix := name[idx+1:]
			isNum := true
			for _, c := range suffix {
				if c < '0' || c > '9' {
					isNum = false
					break
				}
			}
			if isNum {
				chainName = name[:idx]
			}
		}
		handler["chain"] = chainName + "_chains"
	}
	svc["handler"] = handler

	listener := map[string]interface{}{"type": protocol}
	if protocol == "udp" {
		listener["metadata"] = map[string]interface{}{"keepAlive": true}
	}
	svc["listener"] = listener

	if fwdType == 1 {
		svc["forwarder"] = buildForwarder(remoteAddr, strategy)
	}

	return svc
}

func buildRemoteService(name string, outPort int, remoteAddr string, protocol string, strategy string, interfaceName string) map[string]interface{} {
	svc := map[string]interface{}{
		"name": name + "_tls",
		"addr": fmt.Sprintf(":%d", outPort),
	}

	if interfaceName != "" {
		svc["metadata"] = map[string]interface{}{"interface": interfaceName}
	}

	svc["handler"] = map[string]interface{}{"type": "relay"}
	svc["listener"] = map[string]interface{}{"type": protocol}
	svc["forwarder"] = buildForwarder(remoteAddr, strategy)

	return svc
}

func buildForwarder(remoteAddr string, strategy string) map[string]interface{} {
	addrs := strings.Split(remoteAddr, ",")
	var nodes []interface{}
	for i, addr := range addrs {
		nodes = append(nodes, map[string]interface{}{
			"name": fmt.Sprintf("node_%d", i+1),
			"addr": strings.TrimSpace(addr),
		})
	}
	if strategy == "" {
		strategy = "fifo"
	}
	return map[string]interface{}{
		"nodes": nodes,
		"selector": map[string]interface{}{
			"strategy":    strategy,
			"maxFails":    1,
			"failTimeout": "600s",
		},
	}
}

func buildChainData(name string, remoteAddr string, protocol string, interfaceName string) map[string]interface{} {
	dialer := map[string]interface{}{"type": protocol}
	if protocol == "quic" {
		dialer["metadata"] = map[string]interface{}{
			"keepAlive": true,
			"ttl":       "10s",
		}
	}

	node := map[string]interface{}{
		"name":      "node-" + name,
		"addr":      remoteAddr,
		"connector": map[string]interface{}{"type": "relay"},
		"dialer":    dialer,
	}
	if interfaceName != "" {
		node["interface"] = interfaceName
	}

	return map[string]interface{}{
		"name": name + "_chains",
		"hops": []interface{}{
			map[string]interface{}{
				"name":  "hop-" + name,
				"nodes": []interface{}{node},
			},
		},
	}
}

// formatListenAddr formats an IP:port pair, wrapping IPv6 addresses in brackets.
func formatListenAddr(ip string, port int) string {
	if strings.Contains(ip, ":") {
		return fmt.Sprintf("[%s]:%d", ip, port)
	}
	return fmt.Sprintf("%s:%d", ip, port)
}
