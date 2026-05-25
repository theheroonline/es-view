package redis

import (
	"encoding/json"
	"fmt"
)

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
