package main

import (
	"encoding/json"
	"unicode/utf8"
)

// BytesToString converts bytes to string with UTF-8 error handling
// Invalid UTF-8 sequences are replaced with the replacement character (U+FFFD)
func BytesToString(b []byte) string {
	if !utf8.Valid(b) {
		// If the byte sequence is not valid UTF-8, use FromRunes to clean it up
		return string([]rune(string(b)))
	}
	return string(b)
}

// SanitizeJSONString ensures a JSON string is valid UTF-8
func SanitizeJSONString(s string) string {
	if !utf8.ValidString(s) {
		return string([]rune(s))
	}
	return s
}

// SanitizeJSON ensures JSON data is properly UTF-8 encoded
func SanitizeJSON(data []byte) []byte {
	if !utf8.Valid(data) {
		// Decode and re-encode to clean up invalid UTF-8
		var obj interface{}
		if err := json.Unmarshal(data, &obj); err == nil {
			cleaned, _ := json.Marshal(obj)
			return cleaned
		}
		// Fallback: convert using runes
		return []byte(BytesToString(data))
	}
	return data
}

// Constants for database operations
const (
	MaxScanCount = 10000
	DefaultCount = 100
)
