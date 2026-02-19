package config

import (
	"os"
	"strconv"
)

type Config struct {
	DBHost        string
	DBName        string
	DBUser        string
	DBPassword    string
	JWTSecret     string
	LogDir        string
	NodeBinaryDir string
	Port          int
}

var Cfg *Config

func Load() {
	Cfg = &Config{
		DBHost:        getEnv("DB_HOST", "127.0.0.1"),
		DBName:        getEnv("DB_NAME", "gost"),
		DBUser:        getEnv("DB_USER", "root"),
		DBPassword:    getEnv("DB_PASSWORD", ""),
		JWTSecret:     getEnv("JWT_SECRET", "default_jwt_secret"),
		LogDir:        getEnv("LOG_DIR", "/app/logs"),
		NodeBinaryDir: getEnv("NODE_BINARY_DIR", "/data/node"),
		Port:          getEnvInt("SERVER_PORT", 6365),
	}
}

func DSN() string {
	return Cfg.DBUser + ":" + Cfg.DBPassword + "@tcp(" + Cfg.DBHost + ":3306)/" + Cfg.DBName + "?charset=utf8mb4&parseTime=False&loc=Local"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
