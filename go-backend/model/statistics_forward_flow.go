package model

type StatisticsForwardFlow struct {
	ID         int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	ForwardId  int64 `gorm:"column:forward_id;index" json:"forwardId"`
	InFlow     int64 `gorm:"column:in_flow" json:"inFlow"`
	OutFlow    int64 `gorm:"column:out_flow" json:"outFlow"`
	RecordTime int64 `gorm:"column:record_time;index" json:"recordTime"`
}

func (StatisticsForwardFlow) TableName() string {
	return "statistics_forward_flow"
}
