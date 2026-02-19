package pkg

import (
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword creates a bcrypt hash of the given plaintext password.
func HashPassword(plain string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		// Fallback should never happen with valid input, but log and return empty
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
	// Legacy MD5 fallback
	return hashed == Md5WithSalt(plain)
}

// IsBcrypt returns true if the hash looks like a bcrypt hash.
func IsBcrypt(hashed string) bool {
	return strings.HasPrefix(hashed, "$2a$") || strings.HasPrefix(hashed, "$2b$")
}
