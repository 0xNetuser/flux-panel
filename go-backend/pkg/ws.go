package pkg

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"flux-panel/go-backend/config"
	"flux-panel/go-backend/dto"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		allowed := config.Cfg.AllowedOrigins
		if len(allowed) == 0 {
			return true // No restriction configured — backward compatible
		}
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // Non-browser clients (e.g., nodes) have no Origin
		}
		for _, o := range allowed {
			if o == origin {
				return true
			}
		}
		// Also allow same-origin: compare origin host with request host
		if reqURL, err := url.Parse(origin); err == nil {
			if reqURL.Host == r.Host {
				return true
			}
		}
		log.Printf("WebSocket CheckOrigin rejected origin: %s", origin)
		return false
	},
}

type WSManager struct {
	nodeSessions    sync.Map // nodeID(int64) → *NodeSession
	adminSessions   sync.Map // sessionID(string) → *websocket.Conn
	pendingRequests sync.Map // requestID(string) → chan *dto.GostResponse

	// Callbacks set by the application
	OnNodeOnline  func(nodeId int64, version, http, tls, socks string)
	OnNodeOffline func(nodeId int64)
	OnNodeConfig  func(nodeId int64, data string)
}

type NodeSession struct {
	Conn   *websocket.Conn
	Secret string
	mu     sync.Mutex
}

type EncryptedMessage struct {
	Encrypted bool   `json:"encrypted"`
	Data      string `json:"data"`
	Timestamp int64  `json:"timestamp"`
}

type WSCommand struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	RequestId string      `json:"requestId"`
}

type WSResponse struct {
	RequestId string          `json:"requestId"`
	Message   string          `json:"message"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
}

var WS *WSManager

func InitWSManager() {
	WS = &WSManager{}
}

func (m *WSManager) HandleConnection(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	id := q.Get("id")
	connType := q.Get("type")
	secret := q.Get("secret")

	var respHeader http.Header

	if connType != "1" {
		// Admin connection — extract JWT
		// Priority: Sec-WebSocket-Protocol (avoids URL leakage) > query param (backward compat)
		token := ""
		selectedSubprotocol := ""
		for _, sp := range websocket.Subprotocols(r) {
			if ValidateToken(sp) {
				token = sp
				selectedSubprotocol = sp
				break
			}
		}
		if token == "" {
			token = secret // fallback to query param
		}
		if !ValidateToken(token) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		// Echo back the selected subprotocol so the browser handshake succeeds
		if selectedSubprotocol != "" {
			respHeader = http.Header{"Sec-WebSocket-Protocol": {selectedSubprotocol}}
		}
	}

	conn, err := upgrader.Upgrade(w, r, respHeader)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	if connType == "1" {
		// Node connection
		nodeId, err := strconv.ParseInt(id, 10, 64)
		if err != nil {
			conn.Close()
			return
		}

		version := q.Get("nodeVersion")
		httpVal := q.Get("http")
		tlsVal := q.Get("tls")
		socksVal := q.Get("socks")

		// Close existing session if any
		if existing, ok := m.nodeSessions.Load(nodeId); ok {
			old := existing.(*NodeSession)
			old.Conn.Close()
		}

		ns := &NodeSession{Conn: conn, Secret: secret}
		m.nodeSessions.Store(nodeId, ns)

		if m.OnNodeOnline != nil {
			m.OnNodeOnline(nodeId, version, httpVal, tlsVal, socksVal)
		}

		go m.readNodeMessages(nodeId, ns)
	} else {
		// Admin connection
		sessionId := conn.RemoteAddr().String()
		m.adminSessions.Store(sessionId, conn)

		go m.readAdminMessages(sessionId, conn)
	}
}

func (m *WSManager) readNodeMessages(nodeId int64, ns *NodeSession) {
	defer func() {
		// Only update offline if this is still the current session
		if current, ok := m.nodeSessions.Load(nodeId); ok {
			if current.(*NodeSession) == ns {
				m.nodeSessions.Delete(nodeId)
				if m.OnNodeOffline != nil {
					m.OnNodeOffline(nodeId)
				}
			}
		}
		ns.Conn.Close()
	}()

	for {
		_, message, err := ns.Conn.ReadMessage()
		if err != nil {
			log.Printf("Node %d read error: %v", nodeId, err)
			return
		}

		payload := string(message)
		decrypted := m.decryptIfNeeded(payload, ns.Secret)

		if containsStr(decrypted, "memory_usage") {
			m.sendToNode(ns, `{"type":"call"}`)
			// Broadcast system info to admin sessions
			broadcastMsg := map[string]interface{}{
				"id":   strconv.FormatInt(nodeId, 10),
				"type": "info",
				"data": decrypted,
			}
			broadcastJSON, _ := json.Marshal(broadcastMsg)
			m.broadcastToAdmins(string(broadcastJSON))
		} else if containsStr(decrypted, "requestId") {
			log.Printf("收到消息: %s", decrypted)
			var resp WSResponse
			if err := json.Unmarshal([]byte(decrypted), &resp); err == nil && resp.RequestId != "" {
				if ch, ok := m.pendingRequests.LoadAndDelete(resp.RequestId); ok {
					result := &dto.GostResponse{
						Msg: resp.Message,
					}
					if result.Msg == "" {
						result.Msg = "OK"
					}
					if resp.Data != nil {
						var dataMap interface{}
						json.Unmarshal(resp.Data, &dataMap)
						result.Data = dataMap
					}
					ch.(chan *dto.GostResponse) <- result
				}
			}
		} else {
			log.Printf("收到消息: %s", decrypted)
			// Broadcast to admin sessions
			broadcastMsg := map[string]interface{}{
				"id":   strconv.FormatInt(nodeId, 10),
				"type": "info",
				"data": decrypted,
			}
			broadcastJSON, _ := json.Marshal(broadcastMsg)
			m.broadcastToAdmins(string(broadcastJSON))
		}
	}
}

func (m *WSManager) readAdminMessages(sessionId string, conn *websocket.Conn) {
	defer func() {
		m.adminSessions.Delete(sessionId)
		conn.Close()
	}()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			return
		}
	}
}

func (m *WSManager) SendMsg(nodeId int64, data interface{}, cmdType string) *dto.GostResponse {
	val, ok := m.nodeSessions.Load(nodeId)
	if !ok {
		return &dto.GostResponse{Msg: "节点不在线"}
	}
	ns := val.(*NodeSession)

	requestId := generateUUID()
	ch := make(chan *dto.GostResponse, 1)
	m.pendingRequests.Store(requestId, ch)

	cmd := WSCommand{
		Type:      cmdType,
		Data:      data,
		RequestId: requestId,
	}
	cmdJSON, _ := json.Marshal(cmd)

	m.sendToNode(ns, string(cmdJSON))

	select {
	case result := <-ch:
		log.Printf("成功发送消息到节点 %d 并收到响应: %s", nodeId, result.Msg)
		return result
	case <-time.After(10 * time.Second):
		m.pendingRequests.Delete(requestId)
		log.Printf("节点 %d 响应超时", nodeId)
		return &dto.GostResponse{Msg: "等待响应超时"}
	}
}

func (m *WSManager) sendToNode(ns *NodeSession, message string) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	finalMsg := message
	if ns.Secret != "" {
		crypto := GetOrCreateCrypto(ns.Secret)
		if crypto != nil {
			encrypted, err := crypto.Encrypt(message)
			if err == nil {
				enc := EncryptedMessage{
					Encrypted: true,
					Data:      encrypted,
					Timestamp: time.Now().UnixMilli(),
				}
				encJSON, _ := json.Marshal(enc)
				finalMsg = string(encJSON)
			}
		}
	}

	if err := ns.Conn.WriteMessage(websocket.TextMessage, []byte(finalMsg)); err != nil {
		log.Printf("发送WebSocket消息失败: %v", err)
	}
}

func (m *WSManager) broadcastToAdmins(message string) {
	m.adminSessions.Range(func(key, value interface{}) bool {
		conn := value.(*websocket.Conn)
		conn.WriteMessage(websocket.TextMessage, []byte(message))
		return true
	})
}

func (m *WSManager) BroadcastMessage(message string) {
	m.broadcastToAdmins(message)
}

func (m *WSManager) IsNodeOnline(nodeId int64) bool {
	_, ok := m.nodeSessions.Load(nodeId)
	return ok
}

func (m *WSManager) decryptIfNeeded(payload, secret string) string {
	if secret == "" {
		return payload
	}
	var enc EncryptedMessage
	if err := json.Unmarshal([]byte(payload), &enc); err != nil {
		return payload
	}
	if !enc.Encrypted || enc.Data == "" {
		return payload
	}
	crypto := GetOrCreateCrypto(secret)
	if crypto == nil {
		return payload
	}
	decrypted, err := crypto.Decrypt(enc.Data)
	if err != nil {
		log.Printf("WebSocket消息解密失败: %v", err)
		return payload
	}
	return decrypted
}

func containsStr(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func generateUUID() string {
	return GenerateUUIDv4()
}

func GenerateUUIDv4() string {
	b := make([]byte, 16)
	n := time.Now().UnixNano()
	for i := range b {
		b[i] = byte(n >> (i * 4))
		n = n*6364136223846793005 + 1442695040888963407
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	hex := "0123456789abcdef"
	buf := make([]byte, 36)
	idx := 0
	for i, v := range b {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			buf[idx] = '-'
			idx++
		}
		buf[idx] = hex[v>>4]
		buf[idx+1] = hex[v&0x0f]
		idx += 2
	}
	return string(buf)
}
