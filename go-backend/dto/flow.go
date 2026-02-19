package dto

type FlowDto struct {
	N string `json:"n"`
	U int64  `json:"u"`
	D int64  `json:"d"`
}

type GostResponse struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data,omitempty"`
}

type GostConfigDto struct {
	Limiters []ConfigItem `json:"limiters"`
	Chains   []ConfigItem `json:"chains"`
	Services []ConfigItem `json:"services"`
}

type ConfigItem struct {
	Name string `json:"name"`
}
