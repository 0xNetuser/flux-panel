package model

type ViteConfig struct {
	ID    int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name  string `gorm:"column:name" json:"name"`
	Value string `gorm:"column:value" json:"value"`
	Time  int64  `gorm:"column:time" json:"time"`
}

func (ViteConfig) TableName() string {
	return "vite_config"
}
