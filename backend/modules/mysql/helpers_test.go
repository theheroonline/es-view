package mysql

import (
	"reflect"
	"testing"
)

func TestSplitMysqlStatements(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []string
	}{
		{
			"single statement",
			"SELECT * FROM t",
			[]string{"SELECT * FROM t"},
		},
		{
			"two statements",
			"SELECT 1; SELECT 2;",
			[]string{"SELECT 1", "SELECT 2"},
		},
		{
			"semicolon in string literal",
			"INSERT INTO t VALUES ('hello; world')",
			[]string{"INSERT INTO t VALUES ('hello; world')"},
		},
		{
			"semicolon in backtick",
			"SELECT `col;name` FROM t",
			[]string{"SELECT `col;name` FROM t"},
		},
		{
			"line comment with semicolon",
			"-- this has ; a semicolon\nSELECT 1",
			[]string{"-- this has ; a semicolon\nSELECT 1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := splitMysqlStatements(tt.input)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsMysqlResultSetQuery(t *testing.T) {
	tests := []struct {
		query string
		want  bool
	}{
		{"SELECT * FROM users", true},
		{"SHOW TABLES", true},
		{"DESCRIBE users", true},
		{"INSERT INTO users VALUES (1)", false},
		{"DELETE FROM users", false},
		{"UPDATE users SET name = 'x'", false},
		{"  select 1", true}, // case-insensitive
	}

	for _, tt := range tests {
		got := isMysqlResultSetQuery(tt.query)
		if got != tt.want {
			t.Errorf("isMysqlResultSetQuery(%q) = %v, want %v", tt.query, got, tt.want)
		}
	}
}
