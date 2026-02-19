package model

type Tunnel struct {
	ID             int64   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name           string  `gorm:"column:name" json:"name"`
	TrafficRatio   float64 `gorm:"column:traffic_ratio" json:"trafficRatio"`
	InNodeId       int64   `gorm:"column:in_node_id" json:"inNodeId"`
	InIp           string  `gorm:"column:in_ip" json:"inIp"`
	OutNodeId      int64   `gorm:"column:out_node_id" json:"outNodeId"`
	OutIp          string  `gorm:"column:out_ip" json:"outIp"`
	Type           int     `gorm:"column:type" json:"type"`
	Protocol       string  `gorm:"column:protocol" json:"protocol"`
	Flow           int     `gorm:"column:flow" json:"flow"`
	TcpListenAddr  string  `gorm:"column:tcp_listen_addr" json:"tcpListenAddr"`
	UdpListenAddr  string  `gorm:"column:udp_listen_addr" json:"udpListenAddr"`
	InterfaceName  string  `gorm:"column:interface_name" json:"interfaceName"`
	CreatedTime    int64   `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime    int64   `gorm:"column:updated_time" json:"updatedTime"`
	Status         int     `gorm:"column:status" json:"status"`
}

func (Tunnel) TableName() string {
	return "tunnel"
}
