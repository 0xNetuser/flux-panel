package model

type SpeedLimit struct {
	ID          int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string `gorm:"column:name" json:"name"`
	Speed       int    `gorm:"column:speed" json:"speed"`
	TunnelId    int64  `gorm:"column:tunnel_id" json:"tunnelId"`
	TunnelName  string `gorm:"column:tunnel_name" json:"tunnelName"`
	CreatedTime int64  `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime int64  `gorm:"column:updated_time" json:"updatedTime"`
	Status      int    `gorm:"column:status" json:"status"`
}

func (SpeedLimit) TableName() string {
	return "speed_limit"
}
