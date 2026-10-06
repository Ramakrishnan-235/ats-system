package models

import "strings"

type UserRole string

const (
	RoleAdmin       UserRole = "admin"
	RoleRecruiter   UserRole = "recruiter"
	RoleCompliance  UserRole = "compliance"
	RoleInterviewer UserRole = "interviewer"
	RoleViewer      UserRole = "viewer"
)

type UserIdentity struct {
	UserID string   `json:"user_id"`
	Role   UserRole `json:"role"`
	Email  string   `json:"email,omitempty"`
}

func (u *UserIdentity) CanViewPII() bool {
	if u == nil {
		return false
	}
	if strings.TrimSpace(u.UserID) == "" {
		return false
	}
	role := UserRole(strings.ToLower(strings.TrimSpace(string(u.Role))))
	return role == RoleAdmin || role == RoleRecruiter || role == RoleCompliance
}

func (u *UserIdentity) CanViewAudit() bool {
	if u == nil {
		return false
	}
	role := UserRole(strings.ToLower(strings.TrimSpace(string(u.Role))))
	return role == RoleAdmin || role == RoleRecruiter || role == RoleCompliance
}

type AuditLogEntry struct {
	ID           string `json:"id"`
	Timestamp    string `json:"timestamp"`
	ActorID      string `json:"actor_id"`
	ActorRole    string `json:"actor_role"`
	Action       string `json:"action"`
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	Decision     string `json:"decision"` // ALLOWED or DENIED
	Details      string `json:"details"`
	IPAddress    string `json:"ip_address,omitempty"`
	UserAgent    string `json:"user_agent,omitempty"`
}
