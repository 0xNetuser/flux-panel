package model

type XrayClient struct {
	ID             int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	InboundId      int64  `gorm:"column:inbound_id" json:"inboundId"`
	UserId         int64  `gorm:"column:user_id" json:"userId"`
	Email          string `gorm:"column:email" json:"email"`
	UuidOrPassword string `gorm:"column:uuid_or_password" json:"uuidOrPassword"`
	Flow           string `gorm:"column:flow" json:"flow"`
	AlterId        int    `gorm:"column:alter_id" json:"alterId"`
	TotalTraffic   int64  `gorm:"column:total_traffic" json:"totalTraffic"`
	UpTraffic      int64  `gorm:"column:up_traffic" json:"upTraffic"`
	DownTraffic    int64  `gorm:"column:down_traffic" json:"downTraffic"`
	ExpTime        *int64 `gorm:"column:exp_time" json:"expTime"`
	Enable         int    `gorm:"column:enable" json:"enable"`
	Remark         string `gorm:"column:remark" json:"remark"`
	CreatedTime    int64  `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime    int64  `gorm:"column:updated_time" json:"updatedTime"`
}

func (XrayClient) TableName() string {
	return "xray_client"
}
