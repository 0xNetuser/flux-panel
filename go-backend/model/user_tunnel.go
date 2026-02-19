package model

type UserTunnel struct {
	ID            int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	UserId        int64 `gorm:"column:user_id" json:"userId"`
	TunnelId      int64 `gorm:"column:tunnel_id" json:"tunnelId"`
	SpeedId       *int64 `gorm:"column:speed_id" json:"speedId"`
	Num           int   `gorm:"column:num" json:"num"`
	Flow          int64 `gorm:"column:flow" json:"flow"`
	InFlow        int64 `gorm:"column:in_flow" json:"inFlow"`
	OutFlow       int64 `gorm:"column:out_flow" json:"outFlow"`
	FlowResetTime int64 `gorm:"column:flow_reset_time" json:"flowResetTime"`
	ExpTime       int64 `gorm:"column:exp_time" json:"expTime"`
	Status        int   `gorm:"column:status" json:"status"`
}

func (UserTunnel) TableName() string {
	return "user_tunnel"
}
