package dto

type ForwardDto struct {
	Name          string `json:"name" binding:"required"`
	TunnelId      int64  `json:"tunnelId" binding:"required"`
	RemoteAddr    string `json:"remoteAddr" binding:"required"`
	Strategy      string `json:"strategy"`
	InPort        *int   `json:"inPort"`
	InterfaceName string `json:"interfaceName"`
}

type ForwardUpdateDto struct {
	ID            int64  `json:"id" binding:"required"`
	UserId        int64  `json:"userId"`
	Name          string `json:"name" binding:"required"`
	TunnelId      int64  `json:"tunnelId" binding:"required"`
	RemoteAddr    string `json:"remoteAddr" binding:"required"`
	Strategy      string `json:"strategy"`
	InPort        *int   `json:"inPort"`
	InterfaceName string `json:"interfaceName"`
}

type ForwardOrderItem struct {
	ID  int64 `json:"id"`
	Inx int   `json:"inx"`
}
