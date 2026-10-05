package store

import (
	"reflect"
	"regexp"
	"strings"

	"ats-core-go/internal/models"
)

var linkRegex = regexp.MustCompile(`(?i)(?:https?://|www\.)[^\s<>"']+`)

// Mask known profile identifiers as well as contact patterns throughout nested
// notes, quotations and experience. This is field/pattern masking, not NER.
func redactCandidateStrings(candidate *models.Candidate, original *models.Candidate) {
	redactProfileStrings(candidate, original)
}

func redactProfileStrings(profile any, original *models.Candidate) {
	var identifiers []*regexp.Regexp
	for _, text := range []string{original.Name, original.Email, original.Phone, original.Location, original.LinkedIn} {
		if len(strings.TrimSpace(text)) >= 3 {
			identifiers = append(identifiers, regexp.MustCompile(`(?i)`+regexp.QuoteMeta(text)))
		}
	}
	redact := func(text string) string {
		for _, identifier := range identifiers {
			text = identifier.ReplaceAllString(text, "[REDACTED]")
		}
		text = emailRegex.ReplaceAllString(text, "[REDACTED_EMAIL]")
		text = phoneRegex.ReplaceAllString(text, "[REDACTED_PHONE]")
		return linkRegex.ReplaceAllString(text, "[REDACTED_LINK]")
	}
	redactStrings(reflect.ValueOf(profile).Elem(), redact)
}

func redactStrings(value reflect.Value, redact func(string) string) {
	switch value.Kind() {
	case reflect.String:
		if value.CanSet() {
			value.SetString(redact(value.String()))
		}
	case reflect.Interface:
		if value.IsNil() {
			return
		}
		copy := reflect.New(value.Elem().Type()).Elem()
		copy.Set(value.Elem())
		redactStrings(copy, redact)
		if value.CanSet() {
			value.Set(copy)
		}
	case reflect.Pointer:
		if !value.IsNil() {
			redactStrings(value.Elem(), redact)
		}
	case reflect.Struct:
		for i := 0; i < value.NumField(); i++ {
			redactStrings(value.Field(i), redact)
		}
	case reflect.Slice:
		for i := 0; i < value.Len(); i++ {
			redactStrings(value.Index(i), redact)
		}
	case reflect.Map:
		for _, key := range value.MapKeys() {
			item := value.MapIndex(key)
			copy := reflect.New(item.Type()).Elem()
			copy.Set(item)
			redactStrings(copy, redact)
			value.SetMapIndex(key, copy)
		}
	}
}
