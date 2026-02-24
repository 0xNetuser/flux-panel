package socket

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-gost/x/config"
	"github.com/go-gost/x/internal/util/crypto"
	"github.com/go-gost/x/service"
	"github.com/go-gost/x/xray"
	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	psnet "github.com/shirou/gopsutil/v3/net"
)

// NetInterface 网卡信息
type NetInterface struct {
	Name string   `json:"name"` // 网卡名称，如 eth0
	IPs  []string `json:"ips"`  // 绑定的IP地址列表
}

// SystemInfo 系统信息结构体
type SystemInfo struct {
	Uptime           uint64         `json:"uptime"`            // 开机时间	（秒）
	BytesReceived    uint64         `json:"bytes_received"`    // 接收字节数
	BytesTransmitted uint64         `json:"bytes_transmitted"` // 发送字节数
	CPUUsage         float64        `json:"cpu_usage"`         // CPU使用率（百分比）
	MemoryUsage      float64        `json:"memory_usage"`      // 内存使用率（百分比）
	XrayRunning      bool           `json:"v_running"`      // V service running
	XrayVersion      string         `json:"v_version"`      // V service version
	Interfaces       []NetInterface `json:"interfaces"`        // 网卡列表
	PanelAddr        string         `json:"panel_addr"`        // 连接的面板地址
	Runtime          string         `json:"runtime"`           // 运行环境: docker / host
}

// NetworkStats 网络统计信息
type NetworkStats struct {
	BytesReceived    uint64 `json:"bytes_received"`    // 接收字节数
	BytesTransmitted uint64 `json:"bytes_transmitted"` // 发送字节数
}

// CPUInfo CPU信息
type CPUInfo struct {
	Usage float64 `json:"usage"` // CPU使用率（百分比）
}

// MemoryInfo 内存信息
type MemoryInfo struct {
	Usage float64 `json:"usage"` // 内存使用率（百分比）
}

// CommandMessage 命令消息结构体
type CommandMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	RequestId string      `json:"requestId,omitempty"`
}

// CommandResponse 命令响应结构体
type CommandResponse struct {
	Type      string      `json:"type"`
	Success   bool        `json:"success"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	RequestId string      `json:"requestId,omitempty"`
}

// TcpPingRequest TCP ping请求结构体
type TcpPingRequest struct {
	IP        string `json:"ip"`
	Port      int    `json:"port"`
	Count     int    `json:"count"`
	Timeout   int    `json:"timeout"` // 超时时间(毫秒)
	RequestId string `json:"requestId,omitempty"`
}

// TcpPingResponse TCP ping响应结构体
type TcpPingResponse struct {
	IP           string  `json:"ip"`
	Port         int     `json:"port"`
	Success      bool    `json:"success"`
	AverageTime  float64 `json:"averageTime"` // 平均连接时间(ms)
	PacketLoss   float64 `json:"packetLoss"`  // 连接失败率(%)
	ErrorMessage string  `json:"errorMessage,omitempty"`
	RequestId    string  `json:"requestId,omitempty"`
}

type WebSocketReporter struct {
	url            string
	addr           string // 保存服务器地址
	secret         string // 保存密钥
	version        string // 保存版本号
	useTLS         bool   // 是否使用 TLS (wss/https)
	xrayBin        string // camouflaged xray binary name (from config)
	xrayCfg        string // camouflaged xray config file name (from config)
	conn           *websocket.Conn
	reconnectTime  time.Duration
	pingInterval   time.Duration
	configInterval time.Duration
	ctx            context.Context
	cancel         context.CancelFunc
	connected      bool
	connecting     bool              // 新增：正在连接状态
	connMutex      sync.Mutex        // 新增：连接状态锁
	aesCrypto      *crypto.AESCrypto // 新增：AES加密器
	xrayManager    *xray.XrayManager        // Xray 进程管理
	xrayTraffic    *xray.TrafficReporter    // Xray 流量上报
	updating       int32                    // 原子标记：节点更新中
}

// NewWebSocketReporter 创建一个新的WebSocket报告器
func NewWebSocketReporter(serverURL string, secret string) *WebSocketReporter {
	ctx, cancel := context.WithCancel(context.Background())

	// 创建 AES 加密器
	aesCrypto, err := crypto.NewAESCrypto(secret)
	if err != nil {
		fmt.Printf("❌ 创建 AES 加密器失败: %v\n", err)
		aesCrypto = nil
	} else {
		fmt.Printf("🔐 AES 加密器创建成功\n")
	}

	return &WebSocketReporter{
		url:            serverURL,
		reconnectTime:  5 * time.Second,  // 重连间隔
		pingInterval:   2 * time.Second,  // 发送间隔改为2秒
		configInterval: 10 * time.Minute, // 配置上报间隔
		ctx:            ctx,
		cancel:         cancel,
		connected:      false,
		connecting:     false,
		aesCrypto:      aesCrypto,
	}
}

// Start 启动WebSocket报告器
func (w *WebSocketReporter) Start() {
	go w.run()
}

// Stop 停止WebSocket报告器
func (w *WebSocketReporter) Stop() {
	w.cancel()
	if w.conn != nil {
		w.conn.Close()
	}

}

// run 主运行循环
func (w *WebSocketReporter) run() {
	for {
		select {
		case <-w.ctx.Done():
			return
		default:
			// 检查连接状态，避免重复连接
			w.connMutex.Lock()
			needConnect := !w.connected && !w.connecting
			w.connMutex.Unlock()

			if needConnect {
				if err := w.connect(); err != nil {
					fmt.Printf("❌ WebSocket连接失败: %v，%v后重试\n", err, w.reconnectTime)
					select {
					case <-time.After(w.reconnectTime):
						continue
					case <-w.ctx.Done():
						return
					}
				}
			}

			// 连接成功，开始发送消息
			if w.connected {
				w.handleConnection()
			} else {
				// 如果连接失败，等待重试
				select {
				case <-time.After(w.reconnectTime):
					continue
				case <-w.ctx.Done():
					return
				}
			}
		}
	}
}

// connect 建立WebSocket连接
func (w *WebSocketReporter) connect() error {
	w.connMutex.Lock()
	defer w.connMutex.Unlock()

	// 如果已经在连接中或已连接，直接返回
	if w.connecting || w.connected {
		return nil
	}

	// 设置连接中状态
	w.connecting = true
	defer func() {
		w.connecting = false
	}()

	// 重新读取 config.json 获取最新的协议配置
	type LocalConfig struct {
		Addr   string `json:"addr"`
		Secret string `json:"secret"`
		Http   int    `json:"http"`
		Tls    int    `json:"tls"`
		Socks  int    `json:"socks"`
	}

	var cfg LocalConfig
	if b, err := os.ReadFile("config.json"); err == nil {
		json.Unmarshal(b, &cfg)
	}

	// 使用最新的配置重新构建 URL
	wsScheme := "ws"
	if w.useTLS {
		wsScheme = "wss"
	}
	currentURL := wsScheme + "://" + w.addr + "/system-info?type=1&secret=" + w.secret + "&nodeVersion=" + w.version +
		"&http=" + strconv.Itoa(cfg.Http) + "&tls=" + strconv.Itoa(cfg.Tls) + "&socks=" + strconv.Itoa(cfg.Socks)

	u, err := url.Parse(currentURL)
	if err != nil {
		return fmt.Errorf("解析URL失败: %v", err)
	}

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	conn, _, err := dialer.Dial(u.String(), nil)
	if err != nil {
		return fmt.Errorf("连接WebSocket失败: %v", err)
	}

	// 如果在连接过程中已经有连接了，关闭新连接
	if w.conn != nil && w.connected {
		conn.Close()
		return nil
	}

	w.conn = conn
	w.connected = true

	// 设置关闭处理器来检测连接状态
	w.conn.SetCloseHandler(func(code int, text string) error {
		w.connMutex.Lock()
		w.connected = false
		w.connMutex.Unlock()
		return nil
	})

	fmt.Printf("✅ WebSocket连接建立成功 (http=%d, tls=%d, socks=%d)\n", cfg.Http, cfg.Tls, cfg.Socks)
	return nil
}

// handleConnection 处理WebSocket连接
func (w *WebSocketReporter) handleConnection() {
	defer func() {
		w.connMutex.Lock()
		if w.conn != nil {
			w.conn.Close()
			w.conn = nil
		}
		w.connected = false
		w.connMutex.Unlock()
		fmt.Printf("🔌 WebSocket连接已关闭\n")
	}()

	// 启动消息接收goroutine
	go w.receiveMessages()

	// 主发送循环
	ticker := time.NewTicker(w.pingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-w.ctx.Done():
			return
		case <-ticker.C:
			// 检查连接状态
			w.connMutex.Lock()
			isConnected := w.connected
			w.connMutex.Unlock()

			if !isConnected {
				return
			}

			// 获取系统信息并发送
			sysInfo := w.collectSystemInfo()
			if err := w.sendSystemInfo(sysInfo); err != nil {
				fmt.Printf("❌ 发送系统信息失败: %v，准备重连\n", err)
				return
			}
		}
	}
}

// collectSystemInfo 收集系统信息
func (w *WebSocketReporter) collectSystemInfo() SystemInfo {
	networkStats := getNetworkStats()
	cpuInfo := getCPUInfo()
	memoryInfo := getMemoryInfo()

	info := SystemInfo{
		Uptime:           getUptime(),
		BytesReceived:    networkStats.BytesReceived,
		BytesTransmitted: networkStats.BytesTransmitted,
		CPUUsage:         cpuInfo.Usage,
		MemoryUsage:      memoryInfo.Usage,
		Interfaces:       getInterfaces(),
	}

	// Detect runtime environment
	if _, err := os.Stat("/.dockerenv"); err == nil {
		info.Runtime = "docker"
	} else {
		info.Runtime = "host"
	}

	// Attach panel address
	scheme := "http"
	if w.useTLS {
		scheme = "https"
	}
	info.PanelAddr = scheme + "://" + w.addr

	// Attach Xray status if manager is available
	if w.xrayManager != nil {
		info.XrayRunning = w.xrayManager.IsRunning()
		info.XrayVersion = w.xrayManager.GetVersion()
	}

	return info
}

// sendSystemInfo 发送系统信息
func (w *WebSocketReporter) sendSystemInfo(sysInfo SystemInfo) error {
	w.connMutex.Lock()
	defer w.connMutex.Unlock()

	if w.conn == nil || !w.connected {
		return fmt.Errorf("连接未建立")
	}

	// 转换为JSON
	jsonData, err := json.Marshal(sysInfo)
	if err != nil {
		return fmt.Errorf("序列化系统信息失败: %v", err)
	}

	var messageData []byte

	// 如果有加密器，则加密数据
	if w.aesCrypto != nil {
		encryptedData, err := w.aesCrypto.Encrypt(jsonData)
		if err != nil {
			fmt.Printf("⚠️ 加密失败，发送原始数据: %v\n", err)
			messageData = jsonData
		} else {
			// 创建加密消息包装器
			encryptedMessage := map[string]interface{}{
				"encrypted": true,
				"data":      encryptedData,
				"timestamp": time.Now().Unix(),
			}
			messageData, err = json.Marshal(encryptedMessage)
			if err != nil {
				fmt.Printf("⚠️ 序列化加密消息失败，发送原始数据: %v\n", err)
				messageData = jsonData
			}
		}
	} else {
		messageData = jsonData
	}

	// 设置写入超时
	w.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))

	if err := w.conn.WriteMessage(websocket.TextMessage, messageData); err != nil {
		w.connected = false // 标记连接已断开
		return fmt.Errorf("写入消息失败: %v", err)
	}

	return nil
}

// receiveMessages 接收服务端发送的消息
func (w *WebSocketReporter) receiveMessages() {
	for {
		select {
		case <-w.ctx.Done():
			return
		default:
			w.connMutex.Lock()
			conn := w.conn
			connected := w.connected
			w.connMutex.Unlock()

			if conn == nil || !connected {
				return
			}

			// 设置读取超时
			conn.SetReadDeadline(time.Now().Add(30 * time.Second))

			messageType, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					fmt.Printf("❌ WebSocket读取消息错误: %v\n", err)
				}
				w.connMutex.Lock()
				w.connected = false
				w.connMutex.Unlock()
				return
			}

			// 处理接收到的消息
			w.handleReceivedMessage(messageType, message)
		}
	}
}

// handleReceivedMessage 处理接收到的消息
func (w *WebSocketReporter) handleReceivedMessage(messageType int, message []byte) {
	switch messageType {
	case websocket.TextMessage:
		// 先检查是否是加密消息
		var encryptedWrapper struct {
			Encrypted bool   `json:"encrypted"`
			Data      string `json:"data"`
			Timestamp int64  `json:"timestamp"`
		}

		// 尝试解析为加密消息格式
		if err := json.Unmarshal(message, &encryptedWrapper); err == nil && encryptedWrapper.Encrypted {
			if w.aesCrypto != nil {
				// 解密数据
				decryptedData, err := w.aesCrypto.Decrypt(encryptedWrapper.Data)
				if err != nil {
					fmt.Printf("❌ 解密失败: %v\n", err)
					w.sendErrorResponse("DecryptError", fmt.Sprintf("解密失败: %v", err))
					return
				}
				message = decryptedData
			} else {
				fmt.Printf("❌ 收到加密消息但没有加密器\n")
				w.sendErrorResponse("NoDecryptor", "没有可用的解密器")
				return
			}
		}
		// 先尝试解析是否是压缩消息
		var compressedMsg struct {
			Type       string          `json:"type"`
			Compressed bool            `json:"compressed"`
			Data       json.RawMessage `json:"data"`
			RequestId  string          `json:"requestId,omitempty"`
		}

		if err := json.Unmarshal(message, &compressedMsg); err == nil && compressedMsg.Compressed {
			// 处理压缩消息
			fmt.Printf("📥 收到压缩消息，正在解压...\n")

			// 解压数据
			gzipReader, err := gzip.NewReader(bytes.NewReader(compressedMsg.Data))
			if err != nil {
				fmt.Printf("❌ 创建解压读取器失败: %v\n", err)
				w.sendErrorResponse("DecompressError", fmt.Sprintf("解压失败: %v", err))
				return
			}
			defer gzipReader.Close()

			var decompressedData bytes.Buffer
			if _, err := decompressedData.ReadFrom(gzipReader); err != nil {
				fmt.Printf("❌ 解压数据失败: %v\n", err)
				w.sendErrorResponse("DecompressError", fmt.Sprintf("解压失败: %v", err))
				return
			}

			// 使用解压后的数据继续处理
			message = decompressedData.Bytes()

			// 构建解压后的命令消息
			var cmdMsg CommandMessage
			cmdMsg.Type = compressedMsg.Type
			cmdMsg.RequestId = compressedMsg.RequestId
			if err := json.Unmarshal(message, &cmdMsg.Data); err != nil {
				fmt.Printf("❌ 解析解压后的命令数据失败: %v\n", err)
				w.sendErrorResponse("ParseError", fmt.Sprintf("解析命令失败: %v", err))
				return
			}

			if cmdMsg.Type != "call" {
				w.routeCommand(cmdMsg)
			}
		} else {
			// 处理普通消息
			var cmdMsg CommandMessage
			if err := json.Unmarshal(message, &cmdMsg); err != nil {
				fmt.Printf("❌ 解析命令消息失败: %v\n", err)
				w.sendErrorResponse("ParseError", fmt.Sprintf("解析命令失败: %v", err))
				return
			}
			if cmdMsg.Type != "call" {
				w.routeCommand(cmdMsg)
			}
		}

	default:
		fmt.Printf("📨 收到未知类型消息: %d\n", messageType)
	}
}

// routeCommand 路由命令到对应的处理函数
func (w *WebSocketReporter) routeCommand(cmd CommandMessage) {
	jsonBytes, errs := json.Marshal(cmd)
	if errs != nil {
		fmt.Println("Error marshaling JSON:", errs)
		return
	}

	fmt.Println("🔔 收到命令: ", string(jsonBytes))
	var err error
	var response CommandResponse

	// 传递 requestId
	response.RequestId = cmd.RequestId

	switch cmd.Type {
	// Service 相关命令
	case "AddService":
		err = w.handleAddService(cmd.Data)
		response.Type = "AddServiceResponse"
	case "UpdateService":
		err = w.handleUpdateService(cmd.Data)
		response.Type = "UpdateServiceResponse"
	case "DeleteService":
		err = w.handleDeleteService(cmd.Data)
		response.Type = "DeleteServiceResponse"
	case "PauseService":
		err = w.handlePauseService(cmd.Data)
		response.Type = "PauseServiceResponse"
	case "ResumeService":
		err = w.handleResumeService(cmd.Data)
		response.Type = "ResumeServiceResponse"
	case "UpdateForwarder":
		err = w.handleUpdateForwarder(cmd.Data)
		response.Type = "UpdateForwarderResponse"

	// Chain 相关命令
	case "AddChains":
		err = w.handleAddChain(cmd.Data)
		response.Type = "AddChainsResponse"
	case "UpdateChains":
		err = w.handleUpdateChain(cmd.Data)
		response.Type = "UpdateChainsResponse"
	case "DeleteChains":
		err = w.handleDeleteChain(cmd.Data)
		response.Type = "DeleteChainsResponse"

	// Limiter 相关命令
	case "AddLimiters":
		err = w.handleAddLimiter(cmd.Data)
		response.Type = "AddLimitersResponse"
	case "UpdateLimiters":
		err = w.handleUpdateLimiter(cmd.Data)
		response.Type = "UpdateLimitersResponse"
	case "DeleteLimiters":
		err = w.handleDeleteLimiter(cmd.Data)
		response.Type = "DeleteLimitersResponse"

	// TCP Ping 诊断命令
	case "TcpPing":
		var tcpPingResult TcpPingResponse
		tcpPingResult, err = w.handleTcpPing(cmd.Data)
		response.Type = "TcpPingResponse"
		response.Data = tcpPingResult

	// Protocol blocking switches
	case "SetProtocol":
		err = w.handleSetProtocol(cmd.Data)
		response.Type = "SetProtocolResponse"

	// V service commands
	case "VStart":
		err = w.handleXrayStart(cmd.Data)
		response.Type = "VStartResponse"
	case "VStop":
		err = w.handleXrayStop(cmd.Data)
		response.Type = "VStopResponse"
	case "VRestart":
		err = w.handleXrayRestart(cmd.Data)
		response.Type = "VRestartResponse"
	case "VStatus":
		var statusData map[string]interface{}
		statusData, err = w.handleXrayStatus(cmd.Data)
		response.Type = "VStatusResponse"
		response.Data = statusData
	case "VAddInbound":
		err = w.handleXrayAddInbound(cmd.Data)
		response.Type = "VAddInboundResponse"
	case "VRemoveInbound":
		err = w.handleXrayRemoveInbound(cmd.Data)
		response.Type = "VRemoveInboundResponse"
	case "VAddClient":
		err = w.handleXrayAddClient(cmd.Data)
		response.Type = "VAddClientResponse"
	case "VRemoveClient":
		err = w.handleXrayRemoveClient(cmd.Data)
		response.Type = "VRemoveClientResponse"
	case "VGetTraffic":
		var trafficData interface{}
		trafficData, err = w.handleXrayGetTraffic(cmd.Data)
		response.Type = "VGetTrafficResponse"
		response.Data = trafficData
	case "VApplyConfig":
		err = w.handleXrayApplyConfig(cmd.Data)
		response.Type = "VApplyConfigResponse"
	case "VDeployCert":
		err = w.handleXrayDeployCert(cmd.Data)
		response.Type = "VDeployCertResponse"
	case "VSwitchVersion":
		err = w.handleXraySwitchVersion(cmd.Data)
		response.Type = "VSwitchVersionResponse"

	case "NodeUpdateBinary":
		err = w.handleNodeUpdateBinary(cmd.Data)
		response.Type = "NodeUpdateBinaryResponse"

	default:
		err = fmt.Errorf("未知命令类型: %s", cmd.Type)
		response.Type = "UnknownCommandResponse"
	}

	// 发送响应
	if err != nil {
		saveConfig()
		response.Success = false
		response.Message = err.Error()
	} else {
		saveConfig()
		response.Success = true
		response.Message = "OK"
	}

	w.sendResponse(response)
}

// Service 命令处理函数
func (w *WebSocketReporter) handleAddService(data interface{}) error {
	// 将 interface{} 转换为 JSON 再解析为具体类型
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	// 预处理：将字符串格式的 duration 转换为纳秒数
	processedData, err := w.preprocessDurationFields(jsonData)
	if err != nil {
		return fmt.Errorf("预处理duration字段失败: %v", err)
	}

	var services []config.ServiceConfig
	if err := json.Unmarshal(processedData, &services); err != nil {
		return fmt.Errorf("解析服务配置失败: %v", err)
	}

	req := createServicesRequest{Data: services}
	return createServices(req)
}

func (w *WebSocketReporter) handleUpdateService(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	// 预处理：将字符串格式的 duration 转换为纳秒数
	processedData, err := w.preprocessDurationFields(jsonData)
	if err != nil {
		return fmt.Errorf("预处理duration字段失败: %v", err)
	}

	var services []config.ServiceConfig
	if err := json.Unmarshal(processedData, &services); err != nil {
		return fmt.Errorf("解析服务配置失败: %v", err)
	}

	req := updateServicesRequest{Data: services}
	return updateServices(req)
}

func (w *WebSocketReporter) handleDeleteService(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req deleteServicesRequest
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析删除请求失败: %v", err)
	}

	return deleteServices(req)
}

func (w *WebSocketReporter) handlePauseService(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req pauseServicesRequest
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析暂停请求失败: %v", err)
	}

	return pauseServices(req)
}

func (w *WebSocketReporter) handleResumeService(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req resumeServicesRequest
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析恢复请求失败: %v", err)
	}

	return resumeServices(req)
}

func (w *WebSocketReporter) handleUpdateForwarder(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	// 预处理：将字符串格式的 duration 转换为纳秒数（如 failTimeout: "600s" → int64）
	processedData, err := w.preprocessDurationFields(jsonData)
	if err != nil {
		return fmt.Errorf("预处理duration字段失败: %v", err)
	}

	var req updateForwarderRequest
	if err := json.Unmarshal(processedData, &req); err != nil {
		return fmt.Errorf("解析更新转发器请求失败: %v", err)
	}

	return updateForwarder(req)
}

// Chain 命令处理函数
func (w *WebSocketReporter) handleAddChain(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var chainConfig config.ChainConfig
	if err := json.Unmarshal(jsonData, &chainConfig); err != nil {
		return fmt.Errorf("解析链配置失败: %v", err)
	}

	req := createChainRequest{Data: chainConfig}
	return createChain(req)
}

func (w *WebSocketReporter) handleUpdateChain(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	// 对于更新操作，Java端发送的格式可能是: {"chain": "name", "data": {...}}
	var updateReq struct {
		Chain string             `json:"chain"`
		Data  config.ChainConfig `json:"data"`
	}

	// 尝试解析为更新请求格式
	if err := json.Unmarshal(jsonData, &updateReq); err != nil {
		// 如果失败，可能是直接的ChainConfig，从name字段获取chain名称
		var chainConfig config.ChainConfig
		if err := json.Unmarshal(jsonData, &chainConfig); err != nil {
			return fmt.Errorf("解析链配置失败: %v", err)
		}
		updateReq.Chain = chainConfig.Name
		updateReq.Data = chainConfig
	}

	req := updateChainRequest{
		Chain: updateReq.Chain,
		Data:  updateReq.Data,
	}
	return updateChain(req)
}

func (w *WebSocketReporter) handleDeleteChain(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	// 删除操作可能是: {"chain": "name"} 或者直接是链名称字符串
	var deleteReq deleteChainRequest

	// 尝试解析为删除请求格式
	if err := json.Unmarshal(jsonData, &deleteReq); err != nil {
		// 如果失败，可能是字符串格式的名称
		var chainName string
		if err := json.Unmarshal(jsonData, &chainName); err != nil {
			return fmt.Errorf("解析链删除请求失败: %v", err)
		}
		deleteReq.Chain = chainName
	}

	return deleteChain(deleteReq)
}

// Limiter 命令处理函数
func (w *WebSocketReporter) handleAddLimiter(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var limiterConfig config.LimiterConfig
	if err := json.Unmarshal(jsonData, &limiterConfig); err != nil {
		return fmt.Errorf("解析限流器配置失败: %v", err)
	}

	req := createLimiterRequest{Data: limiterConfig}
	return createLimiter(req)
}

func (w *WebSocketReporter) handleUpdateLimiter(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	// 对于更新操作，Java端发送的格式可能是: {"limiter": "name", "data": {...}}
	var updateReq struct {
		Limiter string               `json:"limiter"`
		Data    config.LimiterConfig `json:"data"`
	}

	// 尝试解析为更新请求格式
	if err := json.Unmarshal(jsonData, &updateReq); err != nil {
		// 如果失败，可能是直接的LimiterConfig，从name字段获取limiter名称
		var limiterConfig config.LimiterConfig
		if err := json.Unmarshal(jsonData, &limiterConfig); err != nil {
			return fmt.Errorf("解析限流器配置失败: %v", err)
		}
		updateReq.Limiter = limiterConfig.Name
		updateReq.Data = limiterConfig
	}

	req := updateLimiterRequest{
		Limiter: updateReq.Limiter,
		Data:    updateReq.Data,
	}
	return updateLimiter(req)
}

func (w *WebSocketReporter) handleDeleteLimiter(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	// 删除操作可能是: {"limiter": "name"} 或者直接是限流器名称字符串
	var deleteReq deleteLimiterRequest

	// 尝试解析为删除请求格式
	if err := json.Unmarshal(jsonData, &deleteReq); err != nil {
		// 如果失败，可能是字符串格式的名称
		var limiterName string
		if err := json.Unmarshal(jsonData, &limiterName); err != nil {
			return fmt.Errorf("解析限流器删除请求失败: %v", err)
		}
		deleteReq.Limiter = limiterName
	}

	return deleteLimiter(deleteReq)
}

// handleSetProtocol 处理设置屏蔽协议的命令
func (w *WebSocketReporter) handleSetProtocol(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化协议设置失败: %v", err)
	}

	// 支持 {"http":0/1, "tls":0/1, "socks":0/1}
	var req struct {
		HTTP  *int `json:"http"`
		TLS   *int `json:"tls"`
		SOCKS *int `json:"socks"`
	}
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析协议设置失败: %v", err)
	}

	// 读取当前值作为默认
	httpVal, tlsVal, socksVal := 0, 0, 0

	if req.HTTP != nil {
		if *req.HTTP != 0 && *req.HTTP != 1 {
			return fmt.Errorf("http 取值必须为0或1")
		}
		httpVal = *req.HTTP
	}
	if req.TLS != nil {
		if *req.TLS != 0 && *req.TLS != 1 {
			return fmt.Errorf("tls 取值必须为0或1")
		}
		tlsVal = *req.TLS
	}
	if req.SOCKS != nil {
		if *req.SOCKS != 0 && *req.SOCKS != 1 {
			return fmt.Errorf("socks 取值必须为0或1")
		}
		socksVal = *req.SOCKS
	}

	// 设置至 service，全量传递（未提供的值沿用0）
	service.SetProtocolBlock(httpVal, tlsVal, socksVal)

	// 同步写入本地 config.json
	if err := updateLocalConfigJSON(httpVal, tlsVal, socksVal); err != nil {
		return fmt.Errorf("写入config.json失败: %v", err)
	}
	return nil
}

// updateLocalConfigJSON 将 http/tls/socks 写入工作目录下的 config.json
func updateLocalConfigJSON(httpVal int, tlsVal int, socksVal int) error {
	path := "config.json"

	// 读取现有配置
	type LocalConfig struct {
		Addr   string `json:"addr"`
		Secret string `json:"secret"`
		Http   int    `json:"http"`
		Tls    int    `json:"tls"`
		Socks  int    `json:"socks"`
	}

	var cfg LocalConfig
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &cfg)
	}

	cfg.Http = httpVal
	cfg.Tls = tlsVal
	cfg.Socks = socksVal

	// 写回
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// InitXray initializes the Xray manager for this reporter
func (w *WebSocketReporter) InitXray(binaryPath, configPath, grpcAddr string) {
	w.xrayManager = xray.NewXrayManager(binaryPath, configPath, grpcAddr)
	fmt.Printf("🔧 Service manager initialized (binary=%s, grpc=%s)\n", binaryPath, grpcAddr)
}

// StartXrayTrafficReporter starts the Xray traffic reporter
func (w *WebSocketReporter) StartXrayTrafficReporter(panelAddr string) {
	mgr := w.getOrInitXrayManager()
	w.xrayTraffic = xray.NewTrafficReporter(
		mgr.GetGrpcAddr(),
		panelAddr,
		w.secret,
		mgr.GetBinaryPath(),
		w.useTLS,
	)
	w.xrayTraffic.Start()
	fmt.Printf("📊 Traffic reporter started\n")
}

func (w *WebSocketReporter) getOrInitXrayManager() *xray.XrayManager {
	if w.xrayManager == nil {
		bin := w.xrayBin
		if bin == "" {
			bin = "xray" // backward compat: old nodes without v_bin config
		}
		cfg := w.xrayCfg
		if cfg == "" {
			cfg = "xray_config.json" // backward compat: old nodes without v_cfg config
		}
		w.xrayManager = xray.NewXrayManager(bin, cfg, "127.0.0.1:10085")
	}
	return w.xrayManager
}

func (w *WebSocketReporter) handleXrayStart(data interface{}) error {
	mgr := w.getOrInitXrayManager()
	return mgr.Start()
}

func (w *WebSocketReporter) handleXrayStop(data interface{}) error {
	mgr := w.getOrInitXrayManager()
	return mgr.Stop()
}

func (w *WebSocketReporter) handleXrayRestart(data interface{}) error {
	mgr := w.getOrInitXrayManager()
	return mgr.Restart()
}

func (w *WebSocketReporter) handleXrayStatus(data interface{}) (map[string]interface{}, error) {
	mgr := w.getOrInitXrayManager()
	result := map[string]interface{}{
		"running": mgr.IsRunning(),
		"version": mgr.GetVersion(),
	}
	return result, nil
}

func (w *WebSocketReporter) handleXrayAddInbound(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var inbound xray.InboundConfig
	if err := json.Unmarshal(jsonData, &inbound); err != nil {
		return fmt.Errorf("解析入站配置失败: %v", err)
	}

	mgr := w.getOrInitXrayManager()
	return mgr.HotAddInbound(inbound)
}

func (w *WebSocketReporter) handleXrayRemoveInbound(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req struct {
		Tag string `json:"tag"`
	}
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析删除入站请求失败: %v", err)
	}

	mgr := w.getOrInitXrayManager()
	return mgr.HotRemoveInbound(req.Tag)
}

func (w *WebSocketReporter) handleXrayAddClient(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req struct {
		InboundTag     string `json:"inboundTag"`
		Email          string `json:"email"`
		UuidOrPassword string `json:"uuidOrPassword"`
		Flow           string `json:"flow"`
		AlterId        int    `json:"alterId"`
		Protocol       string `json:"protocol"`
	}
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析添加客户端请求失败: %v", err)
	}

	mgr := w.getOrInitXrayManager()
	return mgr.HotAddUser(req.InboundTag, req.Email, req.UuidOrPassword, req.Flow, req.Protocol, req.AlterId)
}

func (w *WebSocketReporter) handleXrayRemoveClient(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req struct {
		InboundTag string `json:"inboundTag"`
		Email      string `json:"email"`
	}
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析删除客户端请求失败: %v", err)
	}

	mgr := w.getOrInitXrayManager()
	return mgr.HotRemoveUser(req.InboundTag, req.Email)
}

func (w *WebSocketReporter) handleXrayGetTraffic(data interface{}) (interface{}, error) {
	mgr := w.getOrInitXrayManager()
	grpcClient := xray.NewXrayGrpcClient(mgr.GetGrpcAddr())

	stats, err := grpcClient.QueryTraffic(true)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"clients": stats,
	}, nil
}

func (w *WebSocketReporter) handleXrayApplyConfig(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req struct {
		Inbounds []xray.InboundConfig `json:"inbounds"`
	}
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析配置失败: %v", err)
	}

	mgr := w.getOrInitXrayManager()
	return mgr.ApplyConfig(req.Inbounds)
}

func (w *WebSocketReporter) handleXrayDeployCert(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req struct {
		Domain     string `json:"domain"`
		PublicKey  string `json:"publicKey"`
		PrivateKey string `json:"privateKey"`
	}
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析证书部署请求失败: %v", err)
	}

	// Write cert files to disk
	certDir := "certs"
	os.MkdirAll(certDir, 0755)

	certPath := fmt.Sprintf("%s/%s.crt", certDir, req.Domain)
	keyPath := fmt.Sprintf("%s/%s.key", certDir, req.Domain)

	if err := os.WriteFile(certPath, []byte(req.PublicKey), 0644); err != nil {
		return fmt.Errorf("写入证书文件失败: %v", err)
	}
	if err := os.WriteFile(keyPath, []byte(req.PrivateKey), 0600); err != nil {
		return fmt.Errorf("写入私钥文件失败: %v", err)
	}

	fmt.Printf("📜 TLS cert deployed for domain: %s\n", req.Domain)
	return nil
}

func (w *WebSocketReporter) handleXraySwitchVersion(data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	var req struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析版本切换请求失败: %v", err)
	}

	if req.Version == "" {
		return fmt.Errorf("版本号不能为空")
	}

	mgr := w.getOrInitXrayManager()

	// Async: run in goroutine, return immediately
	go func() {
		if err := mgr.SwitchVersion(req.Version); err != nil {
			fmt.Printf("❌ 版本切换失败: %v\n", err)
		}
	}()

	// Return immediately — result will be reflected in SystemInfo xray_version
	return nil
}

func (w *WebSocketReporter) handleNodeUpdateBinary(data interface{}) error {
	if !atomic.CompareAndSwapInt32(&w.updating, 0, 1) {
		return fmt.Errorf("节点正在更新中，请勿重复操作")
	}
	defer atomic.StoreInt32(&w.updating, 0)

	// 使用节点自身 config.json 中的 addr 构建下载地址，
	// 该地址是节点已经成功连接 WebSocket 的地址，保证可达，
	// 避免面板端 panelAddr 可能指向 Cloudflare 代理域名导致下载失败。
	scheme := "http"
	if w.useTLS {
		scheme = "https"
	}
	// Use camouflaged download URL if secret is available
	downloadURL := fmt.Sprintf("%s://%s/s/%s/b/%s", scheme, w.addr, w.secret, runtime.GOARCH)
	fmt.Printf("⬇️ 开始下载节点更新: %s\n", downloadURL)

	// 1. 下载到临时文件
	httpClient := &http.Client{Timeout: 5 * time.Minute}
	resp, err := httpClient.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("下载失败: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("下载失败，状态码: %d", resp.StatusCode)
	}

	tmpFile, err := os.CreateTemp("", "svc-update-*")
	if err != nil {
		return fmt.Errorf("创建临时文件失败: %v", err)
	}
	tmpPath := tmpFile.Name()

	// 限制下载大小为 256MB，防止恶意/异常响应耗尽磁盘
	const maxBinarySize = 256 * 1024 * 1024
	written, err := io.Copy(tmpFile, io.LimitReader(resp.Body, maxBinarySize+1))
	tmpFile.Close()
	if err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("保存下载文件失败: %v", err)
	}
	if written > maxBinarySize {
		os.Remove(tmpPath)
		return fmt.Errorf("下载文件过大 (%d bytes)", written)
	}
	if written < 1024 {
		os.Remove(tmpPath)
		return fmt.Errorf("下载文件异常 (%d bytes)，文件过小", written)
	}

	// 2. 获取当前二进制路径
	currentBinary, err := os.Executable()
	if err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("获取当前二进制路径失败: %v", err)
	}
	// 解析软链接得到真实路径
	currentBinary, _ = filepath.EvalSymlinks(currentBinary)

	// 3. 备份旧二进制
	backupPath := currentBinary + ".bak"
	if err := copyFileForUpdate(currentBinary, backupPath); err != nil {
		fmt.Printf("⚠️ 备份旧二进制失败: %v\n", err)
	} else {
		fmt.Printf("📦 已备份旧二进制到 %s\n", backupPath)
	}

	// 4. 替换二进制（先删除旧文件再写入，避免 "text file busy"）
	os.Remove(currentBinary)
	if err := copyFileForUpdate(tmpPath, currentBinary); err != nil {
		// 尝试从备份恢复
		if restoreErr := copyFileForUpdate(backupPath, currentBinary); restoreErr != nil {
			fmt.Printf("❌ 恢复备份也失败: %v\n", restoreErr)
		} else {
			os.Chmod(currentBinary, 0755)
			fmt.Printf("📦 已从备份恢复\n")
		}
		os.Remove(tmpPath)
		return fmt.Errorf("替换二进制失败: %v", err)
	}
	os.Chmod(currentBinary, 0755)
	os.Remove(tmpPath)

	// 5. Docker 持久化：如果是 Docker 环境，保存到工作目录
	if _, err := os.Stat("/.dockerenv"); err == nil {
		binaryName := filepath.Base(currentBinary)
		persistPath := filepath.Join(".", binaryName)
		if err := copyFileForUpdate(currentBinary, persistPath); err != nil {
			fmt.Printf("⚠️ Docker 持久化失败: %v\n", err)
		} else {
			os.Chmod(persistPath, 0755)
			fmt.Printf("📦 已持久化到 %s\n", persistPath)
		}
	}

	fmt.Printf("✅ 节点更新完成 (%d bytes)，正在退出进程...\n", written)
	// 6. 延迟退出，确保响应先发送回面板
	go func() {
		time.Sleep(1 * time.Second)
		os.Exit(0)
	}()

	return nil
}

// copyFileForUpdate copies a file from src to dst (used by node self-update)
func copyFileForUpdate(src, dst string) error {
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

// handleCall 处理服务端的call回调消息
func (w *WebSocketReporter) handleCall(data interface{}) error {
	// 解析call数据
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化call数据失败: %v", err)
	}

	// 可以根据call的具体内容进行不同的处理
	var callData map[string]interface{}
	if err := json.Unmarshal(jsonData, &callData); err != nil {
		return fmt.Errorf("解析call数据失败: %v", err)
	}

	fmt.Printf("🔔 收到服务端call回调: %v\n", callData)

	// 根据call的类型执行不同的操作
	if callType, exists := callData["type"]; exists {
		switch callType {
		case "ping":
			fmt.Printf("📡 收到ping，发送pong回应\n")
			// 可以在这里发送pong响应
		case "info_request":
			fmt.Printf("📊 服务端请求额外信息\n")
			// 可以在这里发送额外的系统信息
		case "command":
			fmt.Printf("⚡ 服务端发送执行命令\n")
			// 可以在这里执行特定命令
		default:
			fmt.Printf("❓ 未知的call类型: %v\n", callType)
		}
	}

	// 简单返回成功，表示call已被处理
	return nil
}

// sendResponse 发送响应消息到服务端
func (w *WebSocketReporter) sendResponse(response CommandResponse) {
	w.connMutex.Lock()
	defer w.connMutex.Unlock()

	if w.conn == nil || !w.connected {
		fmt.Printf("❌ 无法发送响应：连接未建立\n")
		return
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		fmt.Printf("❌ 序列化响应失败: %v\n", err)
		return
	}

	var messageData []byte

	// 如果有加密器，则加密数据
	if w.aesCrypto != nil {
		encryptedData, err := w.aesCrypto.Encrypt(jsonData)
		if err != nil {
			fmt.Printf("⚠️ 加密响应失败，发送原始数据: %v\n", err)
			messageData = jsonData
		} else {
			// 创建加密消息包装器
			encryptedMessage := map[string]interface{}{
				"encrypted": true,
				"data":      encryptedData,
				"timestamp": time.Now().Unix(),
			}
			messageData, err = json.Marshal(encryptedMessage)
			if err != nil {
				fmt.Printf("⚠️ 序列化加密响应失败，发送原始数据: %v\n", err)
				messageData = jsonData
			}
		}
	} else {
		messageData = jsonData
	}

	// 检查消息大小，如果超过10MB则记录警告
	if len(messageData) > 10*1024*1024 {
		fmt.Printf("⚠️ 响应消息过大 (%.2f MB)，可能会被拒绝\n", float64(len(messageData))/(1024*1024))
	}

	// 设置较长的写入超时，以应对大消息
	timeout := 5 * time.Second
	if len(messageData) > 1024*1024 {
		timeout = 30 * time.Second
	}

	w.conn.SetWriteDeadline(time.Now().Add(timeout))
	if err := w.conn.WriteMessage(websocket.TextMessage, messageData); err != nil {
		fmt.Printf("❌ 发送响应失败: %v\n", err)
		w.connected = false
	}
}

// sendErrorResponse 发送错误响应
func (w *WebSocketReporter) sendErrorResponse(responseType, message string) {
	response := CommandResponse{
		Type:    responseType,
		Success: false,
		Message: message,
	}
	w.sendResponse(response)
}

// getUptime 获取系统开机时间（秒）
func getUptime() uint64 {
	uptime, err := host.Uptime()
	if err != nil {
		return 0
	}
	return uptime
}

// getNetworkStats 获取网络统计信息
func getNetworkStats() NetworkStats {
	var stats NetworkStats

	ioCounters, err := psnet.IOCounters(true)
	if err != nil {
		fmt.Printf("获取网络统计失败: %v\n", err)
		return stats
	}

	// 汇总所有非回环接口的流量
	for _, io := range ioCounters {
		// 跳过回环接口
		if io.Name == "lo" || strings.HasPrefix(io.Name, "lo") {
			continue
		}

		stats.BytesReceived += io.BytesRecv
		stats.BytesTransmitted += io.BytesSent
	}

	return stats
}

// getCPUInfo 获取CPU信息
func getCPUInfo() CPUInfo {
	var cpuInfo CPUInfo

	// 获取CPU使用率
	percentages, err := cpu.Percent(time.Second, false)
	if err == nil && len(percentages) > 0 {
		cpuInfo.Usage = percentages[0]
	}

	return cpuInfo
}

// isVirtualInterface 检查是否为 Docker/K8s 等虚拟网卡
func isVirtualInterface(name string) bool {
	// Docker
	if name == "docker0" || strings.HasPrefix(name, "veth") || strings.HasPrefix(name, "br-") {
		return true
	}
	// Kubernetes / CNI
	if strings.HasPrefix(name, "cni") || strings.HasPrefix(name, "flannel") ||
		strings.HasPrefix(name, "kube-") || strings.HasPrefix(name, "cali") {
		return true
	}
	// Libvirt
	if strings.HasPrefix(name, "virbr") {
		return true
	}
	return false
}

// getInterfaces 获取网卡列表（排除回环、虚拟网卡和无IP的接口）
func getInterfaces() []NetInterface {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var result []NetInterface
	for _, iface := range ifaces {
		// 跳过回环接口和未启用的接口
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		// 跳过 Docker/K8s 等虚拟网卡
		if isVirtualInterface(iface.Name) {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil || len(addrs) == 0 {
			continue
		}
		var ips []string
		for _, addr := range addrs {
			// addr is like "192.168.1.1/24" or "fe80::1/64"
			ip, _, err := net.ParseCIDR(addr.String())
			if err != nil {
				continue
			}
			// 跳过链路本地地址
			if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
				continue
			}
			ips = append(ips, ip.String())
		}
		if len(ips) > 0 {
			result = append(result, NetInterface{Name: iface.Name, IPs: ips})
		}
	}
	return result
}

// getMemoryInfo 获取内存信息
func getMemoryInfo() MemoryInfo {
	var memInfo MemoryInfo

	vmStat, err := mem.VirtualMemory()
	if err != nil {
		return memInfo
	}

	memInfo.Usage = vmStat.UsedPercent

	return memInfo
}

// StartWebSocketReporterWithConfig 使用配置字段启动WebSocket报告器
func StartWebSocketReporterWithConfig(addr string, secret string, http int, tls int, socks int, version string, useTLS bool, xrayBin string, xrayCfg string) *WebSocketReporter {

	// 构建初始 WebSocket URL
	wsScheme := "ws"
	if useTLS {
		wsScheme = "wss"
	}
	fullURL := wsScheme + "://" + addr + "/system-info?type=1&secret=" + secret + "&nodeVersion=" + version + "&http=" + strconv.Itoa(http) + "&tls=" + strconv.Itoa(tls) + "&socks=" + strconv.Itoa(socks)

	fmt.Printf("🔗 WebSocket连接URL: %s\n", fullURL)

	reporter := NewWebSocketReporter(fullURL, secret)
	// 保存 addr, secret, version, useTLS 供重连时使用
	reporter.addr = addr
	reporter.secret = secret
	reporter.version = version
	reporter.useTLS = useTLS
	reporter.xrayBin = xrayBin
	reporter.xrayCfg = xrayCfg
	reporter.Start()
	return reporter
}

// handleTcpPing 处理TCP ping诊断命令
func (w *WebSocketReporter) handleTcpPing(data interface{}) (TcpPingResponse, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return TcpPingResponse{}, fmt.Errorf("序列化TCP ping数据失败: %v", err)
	}

	var req TcpPingRequest
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return TcpPingResponse{}, fmt.Errorf("解析TCP ping请求失败: %v", err)
	}

	// 验证IP地址格式
	if net.ParseIP(req.IP) == nil && !isValidHostname(req.IP) {
		return TcpPingResponse{
			IP:           req.IP,
			Port:         req.Port,
			Success:      false,
			ErrorMessage: "无效的IP地址或主机名",
			RequestId:    req.RequestId,
		}, nil
	}

	// 验证端口范围
	if req.Port <= 0 || req.Port > 65535 {
		return TcpPingResponse{
			IP:           req.IP,
			Port:         req.Port,
			Success:      false,
			ErrorMessage: "无效的端口号，范围应为1-65535",
			RequestId:    req.RequestId,
		}, nil
	}

	// 设置默认值
	if req.Count <= 0 {
		req.Count = 4
	}
	if req.Timeout <= 0 {
		req.Timeout = 5000 // 默认5秒超时
	}

	// 执行TCP ping操作
	avgTime, packetLoss, err := tcpPingHost(req.IP, req.Port, req.Count, req.Timeout)

	response := TcpPingResponse{
		IP:        req.IP,
		Port:      req.Port,
		RequestId: req.RequestId,
	}

	if err != nil {
		response.Success = false
		response.ErrorMessage = err.Error()
	} else {
		response.Success = true
		response.AverageTime = avgTime
		response.PacketLoss = packetLoss
	}

	return response, nil
}

// tcpPingHost 执行TCP连接测试，返回平均连接时间和失败率
func tcpPingHost(ip string, port int, count int, timeoutMs int) (float64, float64, error) {
	var totalTime float64
	var successCount int

	timeout := time.Duration(timeoutMs) * time.Millisecond

	// 使用net.JoinHostPort来正确处理IPv4、IPv6和域名
	// 它会自动为IPv6地址添加方括号
	target := net.JoinHostPort(ip, fmt.Sprintf("%d", port))

	fmt.Printf("🔍 开始TCP ping测试: %s，次数: %d，超时: %dms\n", target, count, timeoutMs)

	// 如果是域名，先解析一次DNS，避免每次连接都重新解析导致延迟累加
	if net.ParseIP(ip) == nil {
		// 是域名，需要解析
		fmt.Printf("🔍 检测到域名，正在解析DNS...\n")
		dnsStart := time.Now()

		addrs, err := net.LookupHost(ip)
		dnsDuration := time.Since(dnsStart)

		if err != nil {
			return 0, 100.0, fmt.Errorf("DNS解析失败: %v", err)
		}
		if len(addrs) == 0 {
			return 0, 100.0, fmt.Errorf("DNS解析未返回任何IP地址")
		}

		fmt.Printf("✅ DNS解析完成 (%.2fms)，解析到 %d 个IP: %v\n",
			dnsDuration.Seconds()*1000, len(addrs), addrs)

		// 使用第一个解析到的IP进行测试
		target = net.JoinHostPort(addrs[0], fmt.Sprintf("%d", port))
		fmt.Printf("🎯 使用IP地址进行测试: %s\n", target)
	} else {
		fmt.Printf("🎯 使用IP地址进行测试: %s\n", target)
	}

	for i := 0; i < count; i++ {
		start := time.Now()

		// 创建带超时的TCP连接
		conn, err := net.DialTimeout("tcp", target, timeout)

		elapsed := time.Since(start)

		if err != nil {
			fmt.Printf("  第%d次连接失败: %v (%.2fms)\n", i+1, err, elapsed.Seconds()*1000)
		} else {
			fmt.Printf("  第%d次连接成功: %.2fms\n", i+1, elapsed.Seconds()*1000)
			conn.Close()
			totalTime += elapsed.Seconds() * 1000 // 转换为毫秒
			successCount++
		}

		// 如果不是最后一次，等待一下再进行下次测试
		if i < count-1 {
			time.Sleep(100 * time.Millisecond)
		}
	}

	if successCount == 0 {
		return 0, 100.0, fmt.Errorf("所有TCP连接尝试都失败")
	}

	avgTime := totalTime / float64(successCount)
	packetLoss := float64(count-successCount) / float64(count) * 100

	fmt.Printf("✅ TCP ping完成: 平均连接时间 %.2fms，失败率 %.1f%%\n", avgTime, packetLoss)

	return avgTime, packetLoss, nil
}

// isValidHostname 验证主机名格式
func isValidHostname(hostname string) bool {
	if len(hostname) == 0 || len(hostname) > 253 {
		return false
	}

	// 简单的主机名验证
	for _, r := range hostname {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '-' || r == '.') {
			return false
		}
	}

	return true
}

// preprocessDurationFields 预处理 JSON 数据中的 duration 字段
func (w *WebSocketReporter) preprocessDurationFields(jsonData []byte) ([]byte, error) {
	var rawData interface{}
	if err := json.Unmarshal(jsonData, &rawData); err != nil {
		return nil, err
	}

	// 递归处理 duration 字段
	processed := w.processDurationInData(rawData)

	return json.Marshal(processed)
}

// processDurationInData 递归处理数据中的 duration 字段
func (w *WebSocketReporter) processDurationInData(data interface{}) interface{} {
	switch v := data.(type) {
	case []interface{}:
		// 处理数组
		for i, item := range v {
			v[i] = w.processDurationInData(item)
		}
		return v
	case map[string]interface{}:
		// 处理对象
		for key, value := range v {
			if key == "selector" {
				// 处理 selector 对象中的 failTimeout
				if selectorObj, ok := value.(map[string]interface{}); ok {
					if failTimeoutVal, exists := selectorObj["failTimeout"]; exists {
						if failTimeoutStr, ok := failTimeoutVal.(string); ok {
							// 将字符串格式的 duration 转换为纳秒数
							if duration, err := time.ParseDuration(failTimeoutStr); err == nil {
								selectorObj["failTimeout"] = int64(duration)
							}
						}
					}
				}
			}
			v[key] = w.processDurationInData(value)
		}
		return v
	default:
		return v
	}
}
