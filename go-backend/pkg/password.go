package pkg

import (
	"crypto/md5"
	"encoding/hex"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword creates a bcrypt hash of the given plaintext password.
func HashPassword(plain string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return ""
	}
	return string(hash)
}

// CheckPassword verifies a plaintext password against a stored hash.
// It auto-detects bcrypt ($2a$/$2b$ prefix) or falls back to the legacy MD5+salt check.
func CheckPassword(plain, hashed string) bool {
	if strings.HasPrefix(hashed, "$2a$") || strings.HasPrefix(hashed, "$2b$") {
		return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain)) == nil
	}
	// Legacy MD5 fallback (for migration only)
	return hashed == legacyMd5Hash(plain)
}

// IsBcrypt returns true if the hash looks like a bcrypt hash.
func IsBcrypt(hashed string) bool {
	return strings.HasPrefix(hashed, "$2a$") || strings.HasPrefix(hashed, "$2b$")
}

// legacyMd5Hash reproduces the old MD5+salt hash for migration compatibility.
// This is intentionally unexported — new code must use bcrypt via HashPassword.
func legacyMd5Hash(input string) string {
	h := md5.New()
	h.Write([]byte(input + "admin_salt_2024"))
	return hex.EncodeToString(h.Sum(nil))
}
