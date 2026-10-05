package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port            string
	Host            string
	DatabaseURL     string
	CORSOrigins     []string
	AuthEnabled     bool
	APIKey          string
	UploadDir       string
	OpenRouterURL   string
	OpenRouterKey   string
	OpenRouterModel string
	OllamaURL       string
	OllamaModel     string
	LLMEnabled      bool
	MaxUploadBytes  int64
}

func Load() *Config {
	port := getEnv("PORT", "8000")
	host := getEnv("HOST", "0.0.0.0")
	dbURL := getEnv("DATABASE_URL", "postgresql://ats_user:ats_password@localhost:5433/ats_db")
	corsRaw := getEnv("ATS_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000")
	corsOrigins := strings.Split(corsRaw, ",")
	for i := range corsOrigins {
		corsOrigins[i] = strings.TrimSpace(corsOrigins[i])
	}

	authEnabled := !strings.EqualFold(strings.TrimSpace(getEnv("ATS_AUTH_ENABLED", "true")), "false")
	apiKey := getEnv("ATS_API_KEY", "")

	uploadDir := getEnv("ATS_UPLOAD_DIR", "./uploads")
	maxUploadBytes, _ := strconv.ParseInt(getEnv("ATS_MAX_UPLOAD_BYTES", "10485760"), 10, 64)

	openRouterURL := getEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
	openRouterKey := getEnv("OPENROUTER_API_KEY", "")
	openRouterModel := getEnv("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")

	ollamaURL := getEnv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
	ollamaModel := getEnv("OLLAMA_MODEL", "gemma4:e2b")

	return &Config{
		Port:            port,
		Host:            host,
		DatabaseURL:     dbURL,
		CORSOrigins:     corsOrigins,
		AuthEnabled:     authEnabled,
		APIKey:          apiKey,
		UploadDir:       uploadDir,
		OpenRouterURL:   openRouterURL,
		OpenRouterKey:   openRouterKey,
		OpenRouterModel: openRouterModel,
		OllamaURL:       ollamaURL,
		OllamaModel:     ollamaModel,
		LLMEnabled:      strings.EqualFold(getEnv("ATS_LLM_ENABLED", "false"), "true"),
		MaxUploadBytes:  maxUploadBytes,
	}
}

// Validate fails startup rather than silently running with broken security/storage.
func (c *Config) Validate() error {
	if c.AuthEnabled && strings.TrimSpace(c.APIKey) == "" {
		return fmt.Errorf("ATS_API_KEY is required when authentication is enabled")
	}
	if c.MaxUploadBytes <= 0 {
		return fmt.Errorf("ATS_MAX_UPLOAD_BYTES must be a positive integer")
	}
	if strings.TrimSpace(c.UploadDir) == "" {
		return fmt.Errorf("ATS_UPLOAD_DIR must not be empty")
	}
	if err := os.MkdirAll(c.UploadDir, 0700); err != nil {
		return fmt.Errorf("create upload directory: %w", err)
	}
	return nil
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
