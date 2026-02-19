package dto

type LoginDto struct {
	Username      string `json:"username" binding:"required"`
	Password      string `json:"password" binding:"required"`
	CaptchaId     string `json:"captchaId"`
	CaptchaAnswer string `json:"captchaAnswer"`
}

type UserDto struct {
	User          string `json:"user" binding:"required"`
	Pwd           string `json:"pwd" binding:"required"`
	Flow          int64  `json:"flow" binding:"required"`
	Num           int    `json:"num" binding:"required"`
	ExpTime       int64  `json:"expTime" binding:"required"`
	FlowResetTime int64  `json:"flowResetTime" binding:"required"`
	Status        *int   `json:"status"`
}

type UserUpdateDto struct {
	ID            int64  `json:"id" binding:"required"`
	User          string `json:"user" binding:"required"`
	Pwd           string `json:"pwd"`
	Flow          int64  `json:"flow" binding:"required"`
	Num           int    `json:"num" binding:"required"`
	ExpTime       int64  `json:"expTime" binding:"required"`
	FlowResetTime int64  `json:"flowResetTime" binding:"required"`
	Status        *int   `json:"status"`
}

type UpdatePasswordDto struct {
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`
	NewUsername  string `json:"newUsername"`
}

type ResetFlowDto struct {
	ID int64 `json:"id" binding:"required"`
}
