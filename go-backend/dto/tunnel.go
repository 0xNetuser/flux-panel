package dto

type TunnelDto struct {
	Name          string   `json:"name" binding:"required"`
	InNodeId      int64    `json:"inNodeId" binding:"required"`
	OutNodeId     *int64   `json:"outNodeId"`
	Type          int      `json:"type" binding:"required"`
	Flow          int      `json:"flow"`
	TrafficRatio  *float64 `json:"trafficRatio"`
	InterfaceName string   `json:"interfaceName"`
	Protocol      string   `json:"protocol"`
	TcpListenAddr string   `json:"tcpListenAddr"`
	UdpListenAddr string   `json:"udpListenAddr"`
}

type TunnelUpdateDto struct {
	ID            int64    `json:"id" binding:"required"`
	Name          string   `json:"name" binding:"required"`
	Flow          int      `json:"flow"`
	TrafficRatio  *float64 `json:"trafficRatio"`
	Protocol      string   `json:"protocol"`
	TcpListenAddr string   `json:"tcpListenAddr"`
	UdpListenAddr string   `json:"udpListenAddr"`
	InterfaceName string   `json:"interfaceName"`
}

type UserTunnelDto struct {
	UserId        int64  `json:"userId" binding:"required"`
	TunnelId      int64  `json:"tunnelId" binding:"required"`
	Num           int    `json:"num"`
	Flow          int64  `json:"flow"`
	FlowResetTime int64  `json:"flowResetTime"`
	ExpTime       int64  `json:"expTime"`
	SpeedId       *int64 `json:"speedId"`
}

type UserTunnelUpdateDto struct {
	ID            int64  `json:"id" binding:"required"`
	Num           *int   `json:"num"`
	Flow          *int64 `json:"flow"`
	FlowResetTime *int64 `json:"flowResetTime"`
	ExpTime       *int64 `json:"expTime"`
	SpeedId       *int64 `json:"speedId"`
	Status        *int   `json:"status"`
}

type UserTunnelRemoveDto struct {
	ID int64 `json:"id" binding:"required"`
}
