package api

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"ats-core-go/internal/config"
	"ats-core-go/internal/models"
)

type contextKey string

const userContextKey contextKey = "user_identity"

func LoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s %s - %v", r.Method, r.URL.Path, r.RemoteAddr, time.Since(start))
	})
}

func GetUserIdentity(r *http.Request) *models.UserIdentity {
	if r == nil {
		return &models.UserIdentity{UserID: "", Role: models.RoleViewer}
	}
	if user, ok := r.Context().Value(userContextKey).(*models.UserIdentity); ok && user != nil {
		return user
	}
	userID := strings.TrimSpace(r.Header.Get("X-User-Id"))
	if userID == "" {
		userID = strings.TrimSpace(r.Header.Get("X-Actor-Id"))
	}
	if userID == "" {
		userID = strings.TrimSpace(r.Header.Get("X-User"))
	}
	roleStr := strings.ToLower(strings.TrimSpace(r.Header.Get("X-User-Role")))
	if roleStr == "" {
		roleStr = strings.ToLower(strings.TrimSpace(r.Header.Get("X-Role")))
	}
	email := strings.TrimSpace(r.Header.Get("X-User-Email"))

	if roleStr != "" {
		return &models.UserIdentity{
			UserID: userID,
			Role:   models.UserRole(roleStr),
			Email:  email,
		}
	}

	// Dev fallback if not wrapped in middleware and no header
	return &models.UserIdentity{
		UserID: func() string {
			if userID != "" {
				return userID
			}
			return "dev-user"
		}(),
		Role: models.RoleRecruiter,
	}
}

func AuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := strings.TrimSpace(r.Header.Get("X-User-Id"))
			if userID == "" {
				userID = strings.TrimSpace(r.Header.Get("X-Actor-Id"))
			}
			if userID == "" {
				userID = strings.TrimSpace(r.Header.Get("X-User"))
			}
			roleStr := strings.ToLower(strings.TrimSpace(r.Header.Get("X-User-Role")))
			if roleStr == "" {
				roleStr = strings.ToLower(strings.TrimSpace(r.Header.Get("X-Role")))
			}
			email := strings.TrimSpace(r.Header.Get("X-User-Email"))

			if !cfg.AuthEnabled {
				userRole := models.RoleRecruiter
				if roleStr != "" {
					userRole = models.UserRole(roleStr)
				}
				if userID == "" {
					userID = "dev-user"
				}
				identity := &models.UserIdentity{UserID: userID, Role: userRole, Email: email}
				ctx := context.WithValue(r.Context(), userContextKey, identity)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			key := strings.TrimSpace(r.Header.Get("X-API-Key"))
			if key == "" {
				authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
				if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "bearer ") {
					key = strings.TrimSpace(authHeader[7:])
				} else {
					key = authHeader
				}
			}
			expectedHash, actualHash := sha256.Sum256([]byte(cfg.APIKey)), sha256.Sum256([]byte(key))
			if cfg.APIKey == "" || key == "" || subtle.ConstantTimeCompare(expectedHash[:], actualHash[:]) != 1 {
				writeError(w, http.StatusUnauthorized, "Invalid or missing API key.")
				return
			}

			userRole := models.RoleViewer
			if roleStr != "" {
				userRole = models.UserRole(roleStr)
			}
			identity := &models.UserIdentity{UserID: userID, Role: userRole, Email: email}
			ctx := context.WithValue(r.Context(), userContextKey, identity)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// SlidingWindowRateLimiter tracks per-client request counts in a 60-second rolling window.
type SlidingWindowRateLimiter struct {
	mu                sync.Mutex
	requestsPerMinute int
	window            time.Duration
	history           map[string][]time.Time
	lastCleanup       time.Time
}

func NewSlidingWindowRateLimiter(rpm int) *SlidingWindowRateLimiter {
	return &SlidingWindowRateLimiter{
		requestsPerMinute: rpm,
		window:            time.Minute,
		history:           make(map[string][]time.Time),
		lastCleanup:       time.Now(),
	}
}

func (l *SlidingWindowRateLimiter) IsAllowed(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-l.window)

	// Periodic cleanup of stale keys
	if now.Sub(l.lastCleanup) > 2*time.Minute {
		for k, timestamps := range l.history {
			if len(timestamps) == 0 || timestamps[len(timestamps)-1].Before(windowStart) {
				delete(l.history, k)
			}
		}
		l.lastCleanup = now
	}

	timestamps := l.history[key]
	var validTimestamps []time.Time
	for _, t := range timestamps {
		if t.After(windowStart) {
			validTimestamps = append(validTimestamps, t)
		}
	}

	if len(validTimestamps) >= l.requestsPerMinute {
		l.history[key] = validTimestamps
		return false
	}

	validTimestamps = append(validTimestamps, now)
	l.history[key] = validTimestamps
	return true
}

func (l *SlidingWindowRateLimiter) Reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.history = make(map[string][]time.Time)
	l.lastCleanup = time.Now()
}

func RateLimitMiddleware(next http.Handler) http.Handler {
	rpm := 120
	if rpmStr := os.Getenv("ATS_RATE_LIMIT_PER_MINUTE"); rpmStr != "" {
		if val, err := strconv.Atoi(rpmStr); err == nil && val > 0 {
			rpm = val
		}
	}
	limiter := NewSlidingWindowRateLimiter(rpm)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if enabled := strings.ToLower(strings.TrimSpace(os.Getenv("ATS_RATE_LIMIT_ENABLED"))); enabled == "false" || enabled == "0" || enabled == "no" || enabled == "off" {
			next.ServeHTTP(w, r)
			return
		}

		path := r.URL.Path
		if path == "/health" || path == "/api/v1/health" || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		clientKey := strings.TrimSpace(r.Header.Get("X-API-Key"))
		if clientKey == "" {
			clientKey = strings.TrimSpace(r.Header.Get("X-User-Id"))
		}
		if clientKey == "" {
			clientKey = r.RemoteAddr
		}

		if !limiter.IsAllowed(clientKey) {
			w.Header().Set("Retry-After", "60")
			writeError(w, http.StatusTooManyRequests, "Rate limit exceeded. Please try again later.")
			return
		}

		next.ServeHTTP(w, r)
	})
}


