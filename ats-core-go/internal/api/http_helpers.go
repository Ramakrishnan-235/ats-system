package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

const maxJSONBytes int64 = 1 << 20

func writeError(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"detail": detail})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBytes)
	decoder := json.NewDecoder(r.Body)
	var raw json.RawMessage
	if err := decoder.Decode(&raw); err != nil {
		var limitError *http.MaxBytesError
		if errors.As(err, &limitError) {
			writeError(w, http.StatusRequestEntityTooLarge, "JSON body exceeds size limit")
			return false
		}
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return false
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		writeError(w, http.StatusBadRequest, "Request body must contain one JSON value")
		return false
	}
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '{' || json.Unmarshal(raw, target) != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON object")
		return false
	}
	return true
}

func validStage(stage string) bool {
	switch stage {
	case "Screening", "Interview", "Qualified", "Offer", "Hired", "Rejected":
		return true
	}
	return false
}
