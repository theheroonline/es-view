package redis

import (
	"encoding/json"
	"testing"
)

func TestNormalizeRedisStringValue(t *testing.T) {
	tests := []struct {
		name  string
		input json.RawMessage
		want  string
	}{
		{"string", json.RawMessage(`"hello"`), "hello"},
		{"empty string", json.RawMessage(`""`), ""},
		{"number", json.RawMessage(`42`), "42"},
		{"null", json.RawMessage(`null`), ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeRedisStringValue(tt.input)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNormalizeRedisHashValue(t *testing.T) {
	input := json.RawMessage(`{"field1": "value1", "field2": "value2"}`)
	got, err := normalizeRedisHashValue(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 fields, got %d", len(got))
	}
	if got["field1"] != "value1" {
		t.Errorf("field1 = %q, want %q", got["field1"], "value1")
	}
}

func TestNormalizeRedisZSetValue(t *testing.T) {
	input := json.RawMessage(`[{"member": "a", "score": 1.5}]`)
	got, err := normalizeRedisZSetValue(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(got))
	}
	if got[0].Member != "a" || got[0].Score != 1.5 {
		t.Errorf("got %+v, want {Member: a, Score: 1.5}", got[0])
	}
}
