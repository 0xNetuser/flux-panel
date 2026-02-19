package dto

import "time"

type R struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Ts   int64       `json:"ts"`
	Data interface{} `json:"data,omitempty"`
}

func Ok(data interface{}) R {
	return R{Code: 0, Msg: "操作成功", Ts: time.Now().UnixMilli(), Data: data}
}

func OkMsg() R {
	return R{Code: 0, Msg: "操作成功", Ts: time.Now().UnixMilli()}
}

func Err(msg string) R {
	return R{Code: -1, Msg: msg, Ts: time.Now().UnixMilli()}
}

func ErrCode(code int, msg string) R {
	return R{Code: code, Msg: msg, Ts: time.Now().UnixMilli()}
}
