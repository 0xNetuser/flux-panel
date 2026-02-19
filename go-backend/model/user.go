package model

type User struct {
	ID            int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	User          string `gorm:"column:user" json:"user"`
	Pwd           string `gorm:"column:pwd" json:"pwd"`
	RoleId        int    `gorm:"column:role_id" json:"roleId"`
	ExpTime       int64  `gorm:"column:exp_time" json:"expTime"`
	Flow          int64  `gorm:"column:flow" json:"flow"`
	InFlow        int64  `gorm:"column:in_flow" json:"inFlow"`
	OutFlow       int64  `gorm:"column:out_flow" json:"outFlow"`
	FlowResetTime int64  `gorm:"column:flow_reset_time" json:"flowResetTime"`
	Num           int    `gorm:"column:num" json:"num"`
	GostEnabled   int    `gorm:"column:gost_enabled;default:1" json:"gostEnabled"`
	XrayEnabled   int    `gorm:"column:xray_enabled;default:1" json:"xrayEnabled"`
	CreatedTime   int64  `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime   int64  `gorm:"column:updated_time" json:"updatedTime"`
	Status        int    `gorm:"column:status" json:"status"`
}

func (User) TableName() string {
	return "user"
}
