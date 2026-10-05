package config

import (
	"os"
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

	authEnabled := strings.ToLower(getEnv("ATS_AUTH_ENABLED", "false")) == "true"
	apiKey := getEnv("ATS_API_KEY", "")

	uploadDir := getEnv("ATS_UPLOAD_DIR", "./uploads")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		// Log or fallback
	}

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
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
