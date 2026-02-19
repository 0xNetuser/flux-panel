package dto

type SpeedLimitDto struct {
	Name     string `json:"name" binding:"required"`
	Speed    int    `json:"speed" binding:"required"`
	TunnelId int64  `json:"tunnelId"`
}

type SpeedLimitUpdateDto struct {
	ID    int64  `json:"id" binding:"required"`
	Name  string `json:"name"`
	Speed *int   `json:"speed"`
}
