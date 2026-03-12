package backend

import "strings"

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
