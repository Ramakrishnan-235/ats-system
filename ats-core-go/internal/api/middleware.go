package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"log"
	"net/http"
	"strings"
	"time"

	"ats-core-go/internal/config"
)

func LoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s %s - %v", r.Method, r.URL.Path, r.RemoteAddr, time.Since(start))
	})
}

func AuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !cfg.AuthEnabled {
				next.ServeHTTP(w, r)
				return
			}
			key := r.Header.Get("X-API-Key")
			if key == "" {
				key = r.Header.Get("Authorization")
				if strings.HasPrefix(key, "Bearer ") {
					key = strings.TrimPrefix(key, "Bearer ")
				}
			}
			expectedHash, actualHash := sha256.Sum256([]byte(cfg.APIKey)), sha256.Sum256([]byte(key))
			if cfg.APIKey == "" || key == "" || subtle.ConstantTimeCompare(expectedHash[:], actualHash[:]) != 1 {
				writeError(w, http.StatusUnauthorized, "Invalid or missing API key.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
