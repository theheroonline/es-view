package mysql

import "testing"

func TestEscapeMysqlIdentifier(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"simple", "mydb", "`mydb`"},
		{"with underscore", "my_database", "`my_database`"},
		{"with backtick", "db`name", "`db``name`"},
		{"multiple backticks", "d``b", "`d````b`"},
		{"empty", "", "``"},
		{"with dash", "my-db", "`my-db`"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := escapeMysqlIdentifier(tt.input)
			if got != tt.want {
				t.Errorf("escapeMysqlIdentifier(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
