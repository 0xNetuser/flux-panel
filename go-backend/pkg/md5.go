package pkg

import (
	"crypto/md5"
	"encoding/hex"
)

const salt = "admin_salt_2024"

func Md5WithSalt(input string) string {
	h := md5.New()
	h.Write([]byte(input + salt))
	return hex.EncodeToString(h.Sum(nil))
}
