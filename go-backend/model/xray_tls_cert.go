package model

type XrayTlsCert struct {
	ID            int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	NodeId        int64  `gorm:"column:node_id" json:"nodeId"`
	Domain        string `gorm:"column:domain" json:"domain"`
	PublicKey     string `gorm:"column:public_key" json:"publicKey"`
	PrivateKey    string `gorm:"column:private_key" json:"privateKey"`
	AutoRenew     int    `gorm:"column:auto_renew" json:"autoRenew"`
	AcmeEnabled   int    `gorm:"column:acme_enabled;default:0" json:"acmeEnabled"`
	AcmeEmail     string `gorm:"column:acme_email" json:"acmeEmail"`
	ChallengeType string `gorm:"column:challenge_type" json:"challengeType"`
	DnsProvider   string `gorm:"column:dns_provider" json:"dnsProvider"`
	DnsConfig     string `gorm:"column:dns_config" json:"dnsConfig"`
	LastRenewTime *int64 `gorm:"column:last_renew_time" json:"lastRenewTime"`
	RenewError    string `gorm:"column:renew_error" json:"renewError"`
	ExpireTime    *int64 `gorm:"column:expire_time" json:"expireTime"`
	CreatedTime   int64  `gorm:"column:created_time" json:"createdTime"`
	UpdatedTime   int64  `gorm:"column:updated_time" json:"updatedTime"`
}

func (XrayTlsCert) TableName() string {
	return "xray_tls_cert"
}
