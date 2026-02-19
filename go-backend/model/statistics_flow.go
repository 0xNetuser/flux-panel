package model

type StatisticsFlow struct {
	ID          int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	UserId      int64  `gorm:"column:user_id" json:"userId"`
	Flow        int64  `gorm:"column:flow" json:"flow"`
	TotalFlow   int64  `gorm:"column:total_flow" json:"totalFlow"`
	Time        string `gorm:"column:time" json:"time"`
	CreatedTime int64  `gorm:"column:created_time" json:"createdTime"`
}

func (StatisticsFlow) TableName() string {
	return "statistics_flow"
}
