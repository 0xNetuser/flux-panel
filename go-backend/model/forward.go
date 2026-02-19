package model

type Forward struct {
	ID            int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	UserId        int64  `gorm:"column:user_id" json:"userId"`
	UserName      string `gorm:"column:user_name" json:"userName"`
	Name          string `gorm:"column:name" json:"name"`
	TunnelId      int64  `gorm:"column:tunnel_id" json:"tunnelId"`
	InPort        int    `gorm:"column:in_port" json:"inPort"`
	OutPort       int    `gorm:"column:out_port" json:"outPort"`
	RemoteAddr    string `gorm:"column:remote_addr" json:"remoteAddr"`
	Strategy      string `gorm:"column:strategy" json:"strategy"`
	InterfaceName string `gorm:"column:interface_name" json:"interfaceName"`
	InFlow        int64  `gorm:"column:in_flow" json:"inFlow"`
	OutFlow       int64  `gorm:"column:out_flow" json:"outFlow"`
	CreatedTime   int64  `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime   int64  `gorm:"column:updated_time" json:"updatedTime"`
	Status        int    `gorm:"column:status" json:"status"`
	Inx           int    `gorm:"column:inx" json:"inx"`
}

func (Forward) TableName() string {
	return "forward"
}
