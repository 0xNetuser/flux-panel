package pkg

import (
	"crypto/rand"
	"encoding/hex"
)

// GenerateSecureSecret generates a cryptographically secure 64-character hex secret.
func GenerateSecureSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// Fallback should never happen on modern systems
		panic("crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}
