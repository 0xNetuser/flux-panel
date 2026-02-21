package model

type XrayInbound struct {
	ID                 int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	NodeId             int64  `gorm:"column:node_id" json:"nodeId"`
	Tag                string `gorm:"column:tag" json:"tag"`
	Protocol           string `gorm:"column:protocol" json:"protocol"`
	Listen             string `gorm:"column:listen" json:"listen"`
	Port               int    `gorm:"column:port" json:"port"`
	SettingsJson       string `gorm:"column:settings_json" json:"settingsJson"`
	StreamSettingsJson string `gorm:"column:stream_settings_json" json:"streamSettingsJson"`
	SniffingJson       string `gorm:"column:sniffing_json" json:"sniffingJson"`
	Remark             string `gorm:"column:remark" json:"remark"`
	CustomEntry        string `gorm:"column:custom_entry" json:"customEntry"`
	Enable             int    `gorm:"column:enable" json:"enable"`
	CreatedTime        int64  `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime        int64  `gorm:"column:updated_time" json:"updatedTime"`
}

func (XrayInbound) TableName() string {
	return "xray_inbound"
}
