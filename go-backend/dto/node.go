package dto

type NodeDto struct {
	Name     string `json:"name" binding:"required"`
	Ip       string `json:"ip" binding:"required"`
	ServerIp string `json:"serverIp" binding:"required"`
	PortSta  int    `json:"portSta" binding:"required"`
	PortEnd  int    `json:"portEnd" binding:"required"`
}

type NodeUpdateDto struct {
	ID       int64  `json:"id" binding:"required"`
	Name     string `json:"name"`
	Ip       string `json:"ip"`
	ServerIp string `json:"serverIp"`
	PortSta  *int   `json:"portSta"`
	PortEnd  *int   `json:"portEnd"`
}
