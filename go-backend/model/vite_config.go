package model

type ViteConfig struct {
	ID    int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name  string `gorm:"column:name;type:varchar(200);uniqueIndex" json:"name"`
	Value string `gorm:"column:value;type:varchar(200)" json:"value"`
	Time  int64  `gorm:"column:time" json:"time"`
}

func (ViteConfig) TableName() string {
	return "vite_config"
}
