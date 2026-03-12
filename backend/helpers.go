package backend

import (
	"database/sql"
	"encoding/json"
	"strings"
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

func scanRowsToNullStringMaps(rows *sql.Rows) ([]string, []map[string]sql.NullString, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, nil, err
	}

	result := make([]map[string]sql.NullString, 0)
	for rows.Next() {
		values := make([]sql.NullString, len(columns))
		destinations := make([]interface{}, len(columns))
		for i := range values {
			destinations[i] = &values[i]
		}

		if err := rows.Scan(destinations...); err != nil {
			return nil, nil, err
		}

		rowMap := make(map[string]sql.NullString, len(columns))
		for i, column := range columns {
			rowMap[strings.ToLower(column)] = values[i]
		}
		result = append(result, rowMap)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	return columns, result, nil
}

func getNullStringValueByIndex(columns []string, row map[string]sql.NullString, index int) sql.NullString {
	if index < 0 || index >= len(columns) {
		return sql.NullString{}
	}

	return row[strings.ToLower(columns[index])]
}

func getNullStringValue(row map[string]sql.NullString, column string) sql.NullString {
	return row[strings.ToLower(column)]
}
