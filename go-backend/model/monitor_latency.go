package model

type MonitorLatency struct {
	ID         int64   `gorm:"primaryKey;autoIncrement" json:"id"`
	ForwardId  int64   `gorm:"column:forward_id;index" json:"forwardId"`
	NodeId     int64   `gorm:"column:node_id" json:"nodeId"`
	TargetAddr string  `gorm:"column:target_addr" json:"targetAddr"`
	Latency    float64 `gorm:"column:latency" json:"latency"`
	Success    bool    `gorm:"column:success" json:"success"`
	RecordTime int64   `gorm:"column:record_time;index" json:"recordTime"`
}

func (MonitorLatency) TableName() string {
	return "monitor_latency"
}
