package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSecureDefaults(t *testing.T) {
	t.Setenv("ATS_AUTH_ENABLED", "")
	t.Setenv("ATS_LLM_ENABLED", "")
	t.Setenv("ATS_API_KEY", "")
	t.Setenv("ATS_MAX_UPLOAD_BYTES", "")
	cfg := Load()
	if !cfg.AuthEnabled || cfg.LLMEnabled || cfg.MaxUploadBytes != 10485760 {
		t.Fatalf("unsafe defaults: %+v", cfg)
	}
	if cfg.Validate() == nil {
		t.Fatal("empty API key accepted")
	}
	for _, falsy := range []string{"false", "0", "no", "off", "FALSE", "No"} {
		t.Setenv("ATS_AUTH_ENABLED", falsy)
		if Load().AuthEnabled {
			t.Fatalf("explicit development opt-out %q ignored", falsy)
		}
	}
}
func TestConfigValidation(t *testing.T) {
	dir := t.TempDir()
	cfg := &Config{AuthEnabled: true, APIKey: "test", MaxUploadBytes: 10, UploadDir: filepath.Join(dir, "uploads")}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	cfg.MaxUploadBytes = 0
	if cfg.Validate() == nil {
		t.Fatal("invalid limit accepted")
	}
	cfg.MaxUploadBytes = 10
	blocked := filepath.Join(dir, "file")
	if err := os.WriteFile(blocked, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	cfg.UploadDir = filepath.Join(blocked, "uploads")
	if cfg.Validate() == nil {
		t.Fatal("storage error swallowed")
	}
	t.Setenv("ATS_MAX_UPLOAD_BYTES", "invalid")
	if Load().MaxUploadBytes != 0 {
		t.Fatal("malformed limit silently defaulted")
	}
}
