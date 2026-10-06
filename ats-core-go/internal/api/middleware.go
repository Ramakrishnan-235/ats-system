package api

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"log"
	"net/http"
	"strings"
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

