package store

import (
	"ats-core-go/internal/models"
	"reflect"
	"slices"
)

// The store owns every value it retains. Copies also keep callers from mutating
// nested data after the store mutex has been released.
func cloneValue(v any) any {
	if v == nil {
		return nil
	}
	return cloneReflect(reflect.ValueOf(v)).Interface()
}

// Experience and task results are JSON-compatible values. Reflection preserves
// concrete map/slice types and numeric precision rather than JSON round-tripping.
func cloneReflect(value reflect.Value) reflect.Value {
	switch value.Kind() {
	case reflect.Interface:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		out := reflect.New(value.Type()).Elem()
		out.Set(cloneReflect(value.Elem()))
		return out
	case reflect.Pointer:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		out := reflect.New(value.Type().Elem())
		out.Elem().Set(cloneReflect(value.Elem()))
		return out
	case reflect.Map:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		out := reflect.MakeMapWithSize(value.Type(), value.Len())
		for _, key := range value.MapKeys() {
			out.SetMapIndex(key, cloneReflect(value.MapIndex(key)))
		}
		return out
	case reflect.Slice:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		out := reflect.MakeSlice(value.Type(), value.Len(), value.Len())
		for i := 0; i < value.Len(); i++ {
			out.Index(i).Set(cloneReflect(value.Index(i)))
		}
		return out
	case reflect.Struct, reflect.Array:
		out := reflect.New(value.Type()).Elem()
		out.Set(value)
		if value.Kind() == reflect.Array {
			for i := 0; i < value.Len(); i++ {
				out.Index(i).Set(cloneReflect(value.Index(i)))
			}
		} else {
			for i := 0; i < value.NumField(); i++ {
				if out.Field(i).CanSet() {
					out.Field(i).Set(cloneReflect(value.Field(i)))
				}
			}
		}
		return out
	default:
		return value
	}
}

func clonePointer[T any](v *T) *T {
	if v == nil {
		return nil
	}
	out := *v
	return &out
}

func cloneCandidate(v *models.Candidate) *models.Candidate {
	if v == nil {
		return nil
	}
	out := *v
	out.YearsOfExperience = clonePointer(v.YearsOfExperience)
	out.CoreSkills = slices.Clone(v.CoreSkills)
	if v.Experience != nil {
		out.Experience = cloneValue(v.Experience).([]any)
	}
	out.Scorecard.OverallMatchScore = clonePointer(v.Scorecard.OverallMatchScore)
	out.Scorecard.Categories = slices.Clone(v.Scorecard.Categories)
	out.Scorecard.RiskFlags = slices.Clone(v.Scorecard.RiskFlags)
	out.Scorecard.SuggestedImprovements = slices.Clone(v.Scorecard.SuggestedImprovements)
	out.Scorecard.SuggestedQuestions = slices.Clone(v.Scorecard.SuggestedQuestions)
	out.Scorecard.TeamNotes = slices.Clone(v.Scorecard.TeamNotes)
	return &out
}

func cloneJob(v *models.Job) *models.Job {
	if v == nil {
		return nil
	}
	out := *v
	out.Avatars = slices.Clone(v.Avatars)
	out.RequiredSkills = slices.Clone(v.RequiredSkills)
	out.TopMatch.Score = clonePointer(v.TopMatch.Score)
	return &out
}

func cloneJobCandidate(v *models.JobCandidate) *models.JobCandidate {
	if v == nil {
		return nil
	}
	out := *v
	out.MatchScore = clonePointer(v.MatchScore)
	out.TechnicalDepthScore = clonePointer(v.TechnicalDepthScore)
	out.SystemDesignScore = clonePointer(v.SystemDesignScore)
	out.Skills = slices.Clone(v.Skills)
	out.SuggestedQuestions = slices.Clone(v.SuggestedQuestions)
	return &out
}

func cloneApplications(values []*models.JobCandidate) []*models.JobCandidate {
	out := make([]*models.JobCandidate, 0, len(values))
	for _, value := range values {
		out = append(out, cloneJobCandidate(value))
	}
	return out
}

func cloneSkill(v *models.TaxonomySkill) *models.TaxonomySkill {
	if v == nil {
		return nil
	}
	out := *v
	out.Aliases = slices.Clone(v.Aliases)
	return &out
}

func cloneTask(v *models.UploadTask) *models.UploadTask {
	if v == nil {
		return nil
	}
	out := *v
	if v.Result != nil {
		out.Result = cloneValue(v.Result).(map[string]any)
	}
	return &out
}
