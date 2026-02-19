package dto

type XrayInboundDto struct {
	NodeId             int64  `json:"nodeId" binding:"required"`
	Tag                string `json:"tag"`
	Protocol           string `json:"protocol" binding:"required"`
	Listen             string `json:"listen"`
	Port               int    `json:"port" binding:"required"`
	SettingsJson       string `json:"settingsJson"`
	StreamSettingsJson string `json:"streamSettingsJson"`
	SniffingJson       string `json:"sniffingJson"`
	Remark             string `json:"remark"`
}

type XrayInboundUpdateDto struct {
	ID                 int64  `json:"id" binding:"required"`
	Tag                string `json:"tag"`
	Protocol           string `json:"protocol"`
	Listen             string `json:"listen"`
	Port               *int   `json:"port"`
	SettingsJson       string `json:"settingsJson"`
	StreamSettingsJson string `json:"streamSettingsJson"`
	SniffingJson       string `json:"sniffingJson"`
	Remark             string `json:"remark"`
}

type XrayClientDto struct {
	InboundId      int64  `json:"inboundId" binding:"required"`
	UserId         int64  `json:"userId"`
	UuidOrPassword string `json:"uuidOrPassword"`
	Flow           string `json:"flow"`
	AlterId        *int   `json:"alterId"`
	TotalTraffic   *int64 `json:"totalTraffic"`
	ExpTime        *int64 `json:"expTime"`
	Remark         string `json:"remark"`
}

type XrayClientUpdateDto struct {
	ID           int64  `json:"id" binding:"required"`
	Flow         string `json:"flow"`
	AlterId      *int   `json:"alterId"`
	TotalTraffic *int64 `json:"totalTraffic"`
	ExpTime      *int64 `json:"expTime"`
	Enable       *int   `json:"enable"`
	Remark       string `json:"remark"`
}

type XrayTlsCertDto struct {
	NodeId     int64  `json:"nodeId" binding:"required"`
	Domain     string `json:"domain" binding:"required"`
	PublicKey  string `json:"publicKey"`
	PrivateKey string `json:"privateKey"`
	AutoRenew  *int   `json:"autoRenew"`
	ExpireTime *int64 `json:"expireTime"`
}
