package pkg

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"sync"
)

type AESCrypto struct {
	gcm cipher.AEAD
}

var (
	cryptoCache sync.Map
)

func NewAESCrypto(secret string) (*AESCrypto, error) {
	hash := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(hash[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &AESCrypto{gcm: gcm}, nil
}

func GetOrCreateCrypto(secret string) *AESCrypto {
	if secret == "" {
		return nil
	}
	if v, ok := cryptoCache.Load(secret); ok {
		return v.(*AESCrypto)
	}
	c, err := NewAESCrypto(secret)
	if err != nil {
		return nil
	}
	cryptoCache.Store(secret, c)
	return c
}

func (c *AESCrypto) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := c.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (c *AESCrypto) Decrypt(encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	nonceSize := c.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := c.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
