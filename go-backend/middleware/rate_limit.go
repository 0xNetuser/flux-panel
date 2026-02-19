package middleware

import (
	"net/http"
	"sync"
	"time"

	"flux-panel/go-backend/dto"

	"github.com/gin-gonic/gin"
)

type ipRecord struct {
	count   int
	resetAt time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	records map[string]*ipRecord
	limit   int
	window  time.Duration
}

// Separate limiters so captcha requests don't consume login quota.
var (
	loginLimiter = newRateLimiter(10, time.Minute)
	captchaLimiter = newRateLimiter(20, time.Minute)

	cleanupOnce sync.Once
)

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		records: make(map[string]*ipRecord),
		limit:   limit,
		window:  window,
	}
}

// startCleanup launches a single background goroutine for all limiters.
func startCleanup() {
	cleanupOnce.Do(func() {
		go func() {
			for {
				time.Sleep(5 * time.Minute)
				loginLimiter.cleanup()
				captchaLimiter.cleanup()
			}
		}()
	})
}

// LoginRateLimit returns a middleware that limits login requests per IP.
func LoginRateLimit() gin.HandlerFunc {
	startCleanup()
	return rateLimitMiddleware(loginLimiter)
}

// CaptchaRateLimit returns a middleware that limits captcha requests per IP.
func CaptchaRateLimit() gin.HandlerFunc {
	startCleanup()
	return rateLimitMiddleware(captchaLimiter)
}

func rateLimitMiddleware(rl *rateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !rl.allow(ip) {
			c.JSON(http.StatusTooManyRequests, dto.Err("请求过于频繁，请稍后再试"))
			c.Abort()
			return
		}
		c.Next()
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	rec, exists := rl.records[ip]
	if !exists || now.After(rec.resetAt) {
		rl.records[ip] = &ipRecord{count: 1, resetAt: now.Add(rl.window)}
		return true
	}
	rec.count++
	return rec.count <= rl.limit
}

func (rl *rateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for ip, rec := range rl.records {
		if now.After(rec.resetAt) {
			delete(rl.records, ip)
		}
	}
}
