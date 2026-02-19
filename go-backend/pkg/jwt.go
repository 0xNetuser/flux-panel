package pkg

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flux-panel/go-backend/config"
	"flux-panel/go-backend/model"
	"strconv"
	"strings"
	"time"
)

const expireDuration = 7 * 24 * time.Hour

func GenerateToken(user *model.User) (string, error) {
	now := time.Now()
	exp := now.Add(expireDuration)

	header := map[string]interface{}{
		"alg": "HmacSHA256",
		"typ": "JWT",
	}
	headerJSON, _ := json.Marshal(header)
	encodedHeader := base64.RawURLEncoding.EncodeToString(headerJSON)

	payload := map[string]interface{}{
		"sub":     intToStr(user.ID),
		"iat":     now.Unix(),
		"exp":     exp.Unix(),
		"user":    user.User,
		"name":    user.User,
		"role_id": user.RoleId,
	}
	payloadJSON, _ := json.Marshal(payload)
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadJSON)

	signature := calcSignature(encodedHeader, encodedPayload)

	return encodedHeader + "." + encodedPayload + "." + signature, nil
}

func ValidateToken(token string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return false
	}
	expected := calcSignature(parts[0], parts[1])
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return false
	}
	payload, err := decodePayload(parts[1])
	if err != nil {
		return false
	}
	exp, ok := payload["exp"].(float64)
	if !ok {
		return false
	}
	return int64(exp) > time.Now().Unix()
}

func GetUserIdFromToken(token string) (int64, error) {
	payload, err := parsePayload(token)
	if err != nil {
		return 0, err
	}
	sub, ok := payload["sub"].(string)
	if !ok {
		return 0, errors.New("invalid sub")
	}
	return strToInt64(sub)
}

func GetRoleIdFromToken(token string) (int, error) {
	payload, err := parsePayload(token)
	if err != nil {
		return 0, err
	}
	roleId, ok := payload["role_id"].(float64)
	if !ok {
		return 0, errors.New("invalid role_id")
	}
	return int(roleId), nil
}

func GetNameFromToken(token string) (string, error) {
	payload, err := parsePayload(token)
	if err != nil {
		return "", err
	}
	name, ok := payload["name"].(string)
	if !ok {
		return "", errors.New("invalid name")
	}
	return name, nil
}

// GenerateSubToken creates a short-lived JWT (24h) for subscription use.
// The token contains a "scope":"subscription" claim to differentiate it from login JWTs.
func GenerateSubToken(userId int64) (string, error) {
	now := time.Now()
	exp := now.Add(24 * time.Hour)

	header := map[string]interface{}{
		"alg": "HmacSHA256",
		"typ": "JWT",
	}
	headerJSON, _ := json.Marshal(header)
	encodedHeader := base64.RawURLEncoding.EncodeToString(headerJSON)

	payload := map[string]interface{}{
		"sub":   intToStr(userId),
		"iat":   now.Unix(),
		"exp":   exp.Unix(),
		"scope": "subscription",
	}
	payloadJSON, _ := json.Marshal(payload)
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadJSON)

	signature := calcSignature(encodedHeader, encodedPayload)
	return encodedHeader + "." + encodedPayload + "." + signature, nil
}

// ValidateSubToken validates a token and checks that scope == "subscription".
func ValidateSubToken(token string) bool {
	if !ValidateToken(token) {
		return false
	}
	payload, err := parsePayload(token)
	if err != nil {
		return false
	}
	scope, _ := payload["scope"].(string)
	return scope == "subscription"
}

func parsePayload(token string) (map[string]interface{}, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid token")
	}
	return decodePayload(parts[1])
}

func decodePayload(encoded string) (map[string]interface{}, error) {
	data, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}
	var payload map[string]interface{}
	err = json.Unmarshal(data, &payload)
	return payload, err
}

func calcSignature(header, payload string) string {
	content := header + "." + payload
	mac := hmac.New(sha256.New, []byte(config.Cfg.JWTSecret))
	mac.Write([]byte(content))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func intToStr(n int64) string {
	return strconv.FormatInt(n, 10)
}

func strToInt64(s string) (int64, error) {
	var n int64
	err := json.Unmarshal([]byte(s), &n)
	return n, err
}
