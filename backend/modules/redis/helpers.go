package redis

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"

	"multi-database-browsing/backend/shared"
)

// safeStringValue wraps shared.SafeStringValue for local convenience.
func safeStringValue(data []byte) (string, string) {
	return shared.SafeStringValue(data)
}

// isUTF8Safe wraps shared.IsUTF8Safe.
func isUTF8Safe(data []byte) bool {
	return shared.IsUTF8Safe(data)
}

// isBinaryData returns true if the string contains non-printable bytes
// (excluding common whitespace like tab, newline, carriage return).
func isBinaryData(s string) bool {
	for i := 0; i < len(s); i++ {
		b := s[i]
		if b < 0x20 && b != '\t' && b != '\n' && b != '\r' {
			return true
		}
	}
	return false
}

// safeSliceValue applies safeStringValue to each element of a string slice.
func safeSliceValue(items []string) ([]string, string) {
	return shared.SafeSliceValue(items)
}

// safeMapValue applies safeStringValue to each value in a string map.
func safeMapValue(m map[string]string) (map[string]string, string) {
	return shared.SafeMapValue(m)
}

// safeZSetValue applies safeStringValue to zset members.
func safeZSetValue(items []redisZSetEntry) ([]redisZSetEntry, string) {
	encoding := "utf8"
	result := make([]redisZSetEntry, len(items))
	for i, item := range items {
		val, enc := safeStringValue([]byte(item.Member))
		result[i] = redisZSetEntry{Member: val, Score: item.Score}
		if enc == "base64" {
			encoding = "base64"
		}
	}
	return result, encoding
}

// detectCompression returns the compression type based on magic bytes:
// gzip (0x1f 0x8b), deflate (0x78 0x01/0x5e/0x9c/0xda).
// Returns empty string if no compression detected.
func detectCompression(data []byte) string {
	if len(data) < 2 {
		return ""
	}
	// gzip: 0x1f 0x8b
	if data[0] == 0x1f && data[1] == 0x8b {
		return "gzip"
	}
	// zlib/deflate: first byte 0x78, second byte is compression level flag
	if data[0] == 0x78 && (data[1] == 0x01 || data[1] == 0x5e || data[1] == 0x9c || data[1] == 0xda) {
		return "deflate"
	}
	return ""
}

// decompressBytes attempts to decompress data using detected compression.
// Returns the decompressed string and the compression type (or empty if none).
func decompressBytes(data []byte) (string, string) {
	compression := detectCompression(data)
	if compression == "" {
		return string(data), ""
	}

	var reader io.Reader
	switch compression {
	case "gzip":
		r, err := gzip.NewReader(bytes.NewReader(data))
		if err != nil {
			return string(data), ""
		}
		defer r.Close()
		reader = r
	case "deflate":
		reader = flate.NewReader(bytes.NewReader(data))
	}

	out, err := io.ReadAll(reader)
	if err != nil {
		return string(data), ""
	}
	return string(out), compression
}

func normalizeRedisStringValue(raw json.RawMessage) (string, error) {
	var value string
	if err := json.Unmarshal(raw, &value); err == nil {
		return value, nil
	}

	var generic interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return "", err
	}

	return fmt.Sprint(generic), nil
}

func normalizeRedisStringSlice(raw json.RawMessage) ([]string, error) {
	var values []string
	if err := json.Unmarshal(raw, &values); err == nil {
		return values, nil
	}

	var generic []interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return nil, err
	}

	values = make([]string, 0, len(generic))
	for _, item := range generic {
		values = append(values, fmt.Sprint(item))
	}

	return values, nil
}

func normalizeRedisHashValue(raw json.RawMessage) (map[string]string, error) {
	var values map[string]string
	if err := json.Unmarshal(raw, &values); err == nil {
		return values, nil
	}

	var generic map[string]interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return nil, err
	}

	values = make(map[string]string, len(generic))
	for key, value := range generic {
		values[key] = fmt.Sprint(value)
	}

	return values, nil
}

func normalizeRedisZSetValue(raw json.RawMessage) ([]redisZSetEntry, error) {
	var values []redisZSetEntry
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil, err
	}

	return values, nil
}
