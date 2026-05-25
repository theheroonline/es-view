package shared

import (
	"encoding/base64"
	"encoding/json"
	"unicode/utf8"
)

// IsUTF8Safe returns true if the data is valid UTF-8.
func IsUTF8Safe(data []byte) bool {
	return utf8.Valid(data)
}

// SafeStringValue returns a JSON-safe string representation of the bytes
// and reports the encoding used. If valid UTF-8, returns the string as-is
// with encoding "utf8". Otherwise returns base64 with encoding "base64".
func SafeStringValue(data []byte) (string, string) {
	if IsUTF8Safe(data) {
		return string(data), "utf8"
	}
	enc := base64.StdEncoding.EncodeToString(data)
	return enc, "base64"
}

// SafeSliceValue applies SafeStringValue to each element of a string slice,
// returning the encoded values and whether any element was base64-encoded.
func SafeSliceValue(items []string) ([]string, string) {
	encoding := "utf8"
	result := make([]string, len(items))
	for i, item := range items {
		val, enc := SafeStringValue([]byte(item))
		result[i] = val
		if enc == "base64" {
			encoding = "base64"
		}
	}
	return result, encoding
}

// SafeMapValue applies SafeStringValue to each value in a string map.
func SafeMapValue(m map[string]string) (map[string]string, string) {
	encoding := "utf8"
	result := make(map[string]string, len(m))
	for k, v := range m {
		val, enc := SafeStringValue([]byte(v))
		result[k] = val
		if enc == "base64" {
			encoding = "base64"
		}
	}
	return result, encoding
}

// BinaryValue is a marker type used to signal that a value has been
// base64-encoded for safe JSON transport. It serializes to JSON as a
// wrapper object with __binary__ and __encoding__ fields.
type BinaryValue struct {
	Value    string `json:"value"`
	Encoding string `json:"encoding"`
}

// MarshalJSON implements custom JSON serialization for BinaryValue.
// When encoding is "utf8", it outputs the raw string. When "base64",
// it outputs a wrapper object for the frontend to detect.
func (v BinaryValue) MarshalJSON() ([]byte, error) {
	if v.Encoding == "utf8" {
		return json.Marshal(v.Value)
	}
	type wrapper struct {
		Binary   string `json:"__binary__"`
		Encoding string `json:"__encoding__"`
	}
	return json.Marshal(wrapper{Binary: v.Value, Encoding: v.Encoding})
}
