package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

// HttpRequest handles HTTP requests to Elasticsearch or other services
// @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
// @param url - Full URL to send request to
// @param body - Request body (JSON string, can be empty for GET requests)
// @return response body as string, error if any
func (a *App) HttpRequest(method string, url string, body string) (string, error) {
	client := &http.Client{}

	var req *http.Request
	var err error

	var bodyReader io.Reader
	if body != "" {
		bodyReader = bytes.NewReader([]byte(body))
	}

	req, err = http.NewRequest(method, url, bodyReader)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	return string(respBody), nil
}
