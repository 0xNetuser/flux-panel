package model

type Node struct {
	ID          int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string `gorm:"column:name" json:"name"`
	Secret      string `gorm:"column:secret" json:"secret"`
	Ip          string `gorm:"column:ip" json:"ip"`
	EntryIps    string `gorm:"column:entry_ips" json:"entryIps"`
	ServerIp    string `gorm:"column:server_ip" json:"serverIp"`
	PortSta     int    `gorm:"column:port_sta" json:"portSta"`
	PortEnd     int    `gorm:"column:port_end" json:"portEnd"`
	Version     string `gorm:"column:version" json:"version"`
	Http        int    `gorm:"column:http" json:"http"`
	Tls         int    `gorm:"column:tls" json:"tls"`
	Socks       int    `gorm:"column:socks" json:"socks"`
	XrayEnabled int    `gorm:"column:xray_enabled" json:"xrayEnabled"`
	XrayVersion string `gorm:"column:xray_version" json:"xrayVersion"`
	XrayStatus  int    `gorm:"column:xray_status" json:"xrayStatus"`
	CreatedTime int64  `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime int64  `gorm:"column:updated_time" json:"updatedTime"`
	Status      int    `gorm:"column:status" json:"status"`
}

func (Node) TableName() string {
	return "node"
}
