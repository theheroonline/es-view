package shared

import (
	"encoding/json"
	"errors"
)

// ErrorCode is a machine-readable error identifier.
type ErrorCode string

const (
	ErrConnectionFailed   ErrorCode = "CONNECTION_FAILED"
	ErrConnectionNotFound ErrorCode = "CONNECTION_NOT_FOUND"
	ErrQueryFailed        ErrorCode = "QUERY_FAILED"
	ErrSchemaError        ErrorCode = "SCHEMA_ERROR"
	ErrAuthFailed         ErrorCode = "AUTH_FAILED"
	ErrTimeout            ErrorCode = "TIMEOUT"
	ErrTransferFailed     ErrorCode = "TRANSFER_FAILED"
)

// AppError is a structured error returned from backend methods.
// Frontend can parse the JSON error string to extract the code and engine.
type AppError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
	Engine  string    `json:"engine,omitempty"`
}

func (e *AppError) Error() string {
	b, _ := json.Marshal(e)
	return string(b)
}

// NewAppError creates an AppError with code, message, and engine tag.
func NewAppError(code ErrorCode, message, engine string) *AppError {
	return &AppError{Code: code, Message: message, Engine: engine}
}

// Wrap wraps an underlying error with a structured code and engine tag.
// If err is nil, returns nil.
func Wrap(err error, code ErrorCode, engine string) *AppError {
	if err == nil {
		return nil
	}
	return &AppError{Code: code, Message: err.Error(), Engine: engine}
}

// NewConnectionFailed is a convenience function for connection failures.
func NewConnectionFailed(engine, message string) *AppError {
	return NewAppError(ErrConnectionFailed, message, engine)
}

// IsErrorCode checks whether err carries the given error code.
func IsErrorCode(err error, code ErrorCode) bool {
	var appErr *AppError
	return errors.As(err, &appErr) && appErr.Code == code
}
