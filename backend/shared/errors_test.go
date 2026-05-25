package shared

import (
	"errors"
	"testing"
)

func TestAppError_Error(t *testing.T) {
	err := NewAppError(ErrConnectionFailed, "db is down", "mysql")
	got := err.Error()
	want := `{"code":"CONNECTION_FAILED","message":"db is down","engine":"mysql"}`
	if got != want {
		t.Errorf("AppError.Error() = %s, want %s", got, want)
	}
}

func TestNewConnectionFailed(t *testing.T) {
	err := NewConnectionFailed("redis", "refused")
	if err.Code != ErrConnectionFailed {
		t.Errorf("Code = %v, want %v", err.Code, ErrConnectionFailed)
	}
	if err.Engine != "redis" {
		t.Errorf("Engine = %v, want redis", err.Engine)
	}
}

func TestWrap(t *testing.T) {
	orig := errors.New("underlying error")
	appErr := Wrap(orig, ErrQueryFailed, "mysql")
	if appErr == nil {
		t.Fatal("Wrap returned nil")
	}
	if appErr.Message != "underlying error" {
		t.Errorf("Message = %v, want underlying error", appErr.Message)
	}
	if appErr.Code != ErrQueryFailed {
		t.Errorf("Code = %v, want %v", appErr.Code, ErrQueryFailed)
	}

	// nil input
	if Wrap(nil, ErrQueryFailed, "mysql") != nil {
		t.Error("Wrap(nil) should return nil")
	}
}

func TestIsErrorCode(t *testing.T) {
	err := NewConnectionFailed("mysql", "failed")
	if !IsErrorCode(err, ErrConnectionFailed) {
		t.Error("IsErrorCode should return true for CONNECTION_FAILED")
	}
	if IsErrorCode(err, ErrQueryFailed) {
		t.Error("IsErrorCode should return false for QUERY_FAILED")
	}
	if IsErrorCode(nil, ErrConnectionFailed) {
		t.Error("IsErrorCode(nil) should return false")
	}
}
