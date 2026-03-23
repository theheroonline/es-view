package mysql

import (
	"database/sql"
	"fmt"
	"strings"
	"unicode"
)

func firstMysqlKeyword(statement string) string {
	remaining := strings.TrimSpace(statement)

	for remaining != "" {
		switch {
		case strings.HasPrefix(remaining, "("):
			remaining = strings.TrimSpace(remaining[1:])
			continue
		case strings.HasPrefix(remaining, "--"):
			if newline := strings.IndexByte(remaining, '\n'); newline >= 0 {
				remaining = strings.TrimSpace(remaining[newline+1:])
				continue
			}
			return ""
		case strings.HasPrefix(remaining, "#"):
			if newline := strings.IndexByte(remaining, '\n'); newline >= 0 {
				remaining = strings.TrimSpace(remaining[newline+1:])
				continue
			}
			return ""
		case strings.HasPrefix(remaining, "/*"):
			end := strings.Index(remaining, "*/")
			if end >= 0 {
				remaining = strings.TrimSpace(remaining[end+2:])
				continue
			}
			return ""
		}
		break
	}

	if remaining == "" {
		return ""
	}

	idx := -1
	for i, r := range remaining {
		if !unicode.IsLetter(r) {
			idx = i
			break
		}
	}
	if idx == -1 {
		idx = len(remaining)
	}

	return strings.ToLower(remaining[:idx])
}

func isMysqlResultSetQuery(statement string) bool {
	switch firstMysqlKeyword(statement) {
	case "select", "show", "describe", "desc", "explain", "with":
		return true
	default:
		return false
	}
}

func escapeMysqlIdentifier(name string) string {
	return "`" + strings.ReplaceAll(name, "`", "``") + "`"
}

func escapeMysqlLiteral(value string) string {
	escaped := strings.ReplaceAll(value, "'", "''")
	return "'" + escaped + "'"
}

func splitMysqlStatements(input string) []string {
	statements := make([]string, 0)
	var current strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	inBacktick := false
	inLineComment := false
	inBlockComment := false

	for index := 0; index < len(input); index++ {
		char := input[index]
		nextChar := byte(0)
		if index+1 < len(input) {
			nextChar = input[index+1]
		}

		if inLineComment {
			current.WriteByte(char)
			if char == '\n' {
				inLineComment = false
			}
			continue
		}

		if inBlockComment {
			current.WriteByte(char)
			if char == '*' && nextChar == '/' {
				current.WriteByte(nextChar)
				index++
				inBlockComment = false
			}
			continue
		}

		if !inSingleQuote && !inDoubleQuote && !inBacktick {
			if char == '-' && nextChar == '-' {
				current.WriteByte(char)
				current.WriteByte(nextChar)
				index++
				inLineComment = true
				continue
			}
			if char == '#' {
				current.WriteByte(char)
				inLineComment = true
				continue
			}
			if char == '/' && nextChar == '*' {
				current.WriteByte(char)
				current.WriteByte(nextChar)
				index++
				inBlockComment = true
				continue
			}
		}

		escaped := index > 0 && input[index-1] == '\\'
		if char == '\'' && !inDoubleQuote && !inBacktick && !escaped {
			inSingleQuote = !inSingleQuote
			current.WriteByte(char)
			continue
		}
		if char == '"' && !inSingleQuote && !inBacktick && !escaped {
			inDoubleQuote = !inDoubleQuote
			current.WriteByte(char)
			continue
		}
		if char == '`' && !inSingleQuote && !inDoubleQuote {
			inBacktick = !inBacktick
			current.WriteByte(char)
			continue
		}

		if char == ';' && !inSingleQuote && !inDoubleQuote && !inBacktick {
			statement := strings.TrimSpace(current.String())
			if statement != "" {
				statements = append(statements, statement)
			}
			current.Reset()
			continue
		}

		current.WriteByte(char)
	}

	statement := strings.TrimSpace(current.String())
	if statement != "" {
		statements = append(statements, statement)
	}

	return statements
}

func shouldExecuteMysqlStatement(statement string) bool {
	trimmed := strings.TrimSpace(statement)
	if trimmed == "" {
		return false
	}

	upper := strings.ToUpper(trimmed)
	if strings.HasPrefix(upper, "DELIMITER ") {
		return false
	}
	if strings.HasPrefix(trimmed, "--") || strings.HasPrefix(trimmed, "#") {
		return false
	}
	if strings.HasPrefix(trimmed, "/*") && strings.HasSuffix(trimmed, "*/") {
		return false
	}

	return true
}

func formatMysqlValue(value any) string {
	if value == nil {
		return "NULL"
	}

	switch typed := value.(type) {
	case []byte:
		if sql.RawBytes(typed) != nil {
			return escapeMysqlLiteral(string(typed))
		}
		return escapeMysqlLiteral(string(typed))
	case string:
		return escapeMysqlLiteral(typed)
	default:
		return escapeMysqlLiteral(fmt.Sprint(typed))
	}
}
