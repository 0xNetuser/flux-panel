package dto

type LoginDto struct {
	Username      string `json:"username" binding:"required"`
	Password      string `json:"password" binding:"required"`
	CaptchaId     string `json:"captchaId"`
	CaptchaAnswer string `json:"captchaAnswer"`
}

type UserDto struct {
	User          string  `json:"user" binding:"required"`
	Pwd           string  `json:"pwd" binding:"required"`
	Flow          int64   `json:"flow"`
	Num           int     `json:"num"`
	ExpTime       int64   `json:"expTime"`
	FlowResetTime int64   `json:"flowResetTime"`
	Status        *int    `json:"status"`
	GostEnabled   *int    `json:"gostEnabled"`
	XrayEnabled   *int    `json:"xrayEnabled"`
	NodeIds       []int64 `json:"nodeIds"`
}

type UserUpdateDto struct {
	ID            int64   `json:"id" binding:"required"`
	User          string  `json:"user" binding:"required"`
	Pwd           string  `json:"pwd"`
	Flow          int64   `json:"flow"`
	Num           int     `json:"num"`
	ExpTime       int64   `json:"expTime"`
	FlowResetTime int64   `json:"flowResetTime"`
	Status        *int    `json:"status"`
	GostEnabled   *int    `json:"gostEnabled"`
	XrayEnabled   *int    `json:"xrayEnabled"`
	NodeIds       []int64 `json:"nodeIds"`
}

type UpdatePasswordDto struct {
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`
	NewUsername  string `json:"newUsername"`
}

type ResetFlowDto struct {
	ID int64 `json:"id" binding:"required"`
}
