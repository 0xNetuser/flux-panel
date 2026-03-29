package dto

type NodeDto struct {
	Name      string `json:"name" binding:"required"`
	Ip        string `json:"ip"`
	EntryIps  string `json:"entryIps"`
	ServerIp  string `json:"serverIp" binding:"required"`
	PortSta   int    `json:"portSta"`
	PortEnd   int    `json:"portEnd"`
	GroupName string `json:"groupName"`
}

type NodeUpdateDto struct {
	ID        int64   `json:"id" binding:"required"`
	Name      string  `json:"name"`
	Ip        string  `json:"ip"`
	EntryIps  string  `json:"entryIps"`
	ServerIp  string  `json:"serverIp"`
	PortSta   *int    `json:"portSta"`
	PortEnd   *int    `json:"portEnd"`
	GroupName *string `json:"groupName"`
}

type NodeSetProtocolDto struct {
	ID    int64 `json:"id" binding:"required"`
	Http  int   `json:"http" binding:"oneof=0 1"`
	Tls   int   `json:"tls" binding:"oneof=0 1"`
	Socks int   `json:"socks" binding:"oneof=0 1"`
}
