package model

type XrayTlsCert struct {
	ID          int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	NodeId      int64  `gorm:"column:node_id" json:"nodeId"`
	Domain      string `gorm:"column:domain" json:"domain"`
	PublicKey   string `gorm:"column:public_key" json:"publicKey"`
	PrivateKey  string `gorm:"column:private_key" json:"privateKey"`
	AutoRenew   int    `gorm:"column:auto_renew" json:"autoRenew"`
	ExpireTime  *int64 `gorm:"column:expire_time" json:"expireTime"`
	CreatedTime int64  `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime int64  `gorm:"column:updated_time" json:"updatedTime"`
}

func (XrayTlsCert) TableName() string {
	return "xray_tls_cert"
}
