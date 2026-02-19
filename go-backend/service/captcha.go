package service

import (
	"flux-panel/go-backend/dto"

	"github.com/mojocn/base64Captcha"
)

var captchaStore = base64Captcha.DefaultMemStore

func CaptchaGenerate() dto.R {
	driver := base64Captcha.NewDriverString(80, 240, 5, 2, 4, "0123456789abcdefghijklmnopqrstuvwxyz", nil, nil, nil)
	captcha := base64Captcha.NewCaptcha(driver, captchaStore)
	id, b64s, _, err := captcha.Generate()
	if err != nil {
		return dto.Err("生成验证码失败")
	}

	return dto.Ok(map[string]interface{}{
		"captchaId":    id,
		"captchaImage": b64s,
	})
}

func CaptchaVerify(captchaId, answer string) dto.R {
	if captchaId == "" || answer == "" {
		return dto.Err("验证码参数不能为空")
	}

	if captchaStore.Verify(captchaId, answer, true) {
		return dto.Ok("验证成功")
	}
	return dto.Err("验证码错误")
}

func CaptchaCheck(captchaId string) bool {
	return captchaId != "" && captchaStore.Get(captchaId, false) != ""
}
