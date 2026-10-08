package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ats-core-go/internal/api"
	"ats-core-go/internal/config"
	"ats-core-go/internal/services"
	"ats-core-go/internal/store"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Invalid configuration: %v", err)
	}

	// Initialize thread-safe store with seed data
	st := store.GetStore()

	// Initialize services
	eval := services.NewLLMEvaluator(cfg)
	matchSvc := services.NewMatchService(st, eval)
	pdfParser := services.NewPDFParser()

	// Build router
	router := api.NewRouter(cfg, st, eval, matchSvc, pdfParser)

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadTimeout:       30 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Channel to catch OS signals for graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("=====================================================")
		log.Printf("🚀 ATS Core (Golang Edition) listening on http://%s", addr)
		log.Printf("   Runtime: Go 1.27 High-Throughput Engine")
		log.Printf("   CORS Origins: %v", cfg.CORSOrigins)
		log.Printf("   Auth Enabled: %v", cfg.AuthEnabled)
		log.Printf("=====================================================")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server startup failed: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down ATS Core gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Drain in-flight background upload goroutines and ensure staged files are not orphaned
	if err := api.DrainUploads(ctx); err != nil {
		log.Printf("Upload goroutines drain error: %v", err)
	}

	log.Println("ATS Core exited cleanly.")
}
