package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// HttpRequestParams represents parameters for HTTP requests
type HttpRequestParams struct {
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	VerifyTls bool              `json:"verifyTls"`
	Auth      *AuthConfig       `json:"auth"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	AuthType string `json:"authType"`
	Username string `json:"username"`
	Password string `json:"password"`
	ApiKey   string `json:"apiKey"`
}

// HttpRequest handles HTTP requests to Elasticsearch or other services
func (a *App) HttpRequest(params HttpRequestParams) (string, error) {
	client := &http.Client{}

	var req *http.Request
	var err error

	var bodyReader io.Reader
	if params.Body != "" {
		bodyReader = bytes.NewReader([]byte(params.Body))
	}

	req, err = http.NewRequest(params.Method, params.URL, bodyReader)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Set default headers
	req.Header.Set("Content-Type", "application/json")

	// Apply custom headers
	if params.Headers != nil {
		for key, value := range params.Headers {
			req.Header.Set(key, value)
		}
	}

	// Apply authentication
	if params.Auth != nil {
		switch params.Auth.AuthType {
		case "basic":
			if params.Auth.Username != "" && params.Auth.Password != "" {
				token := base64.StdEncoding.EncodeToString([]byte(params.Auth.Username + ":" + params.Auth.Password))
				req.Header.Set("Authorization", "Basic "+token)
			}
		case "apiKey":
			if params.Auth.ApiKey != "" {
				req.Header.Set("Authorization", "ApiKey "+params.Auth.ApiKey)
			}
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// Return JSON response with status code
	result := map[string]interface{}{
		"status": resp.StatusCode,
		"ok":     resp.StatusCode >= 200 && resp.StatusCode < 300,
		"body":   string(respBody),
	}
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal response: %w", err)
	}
	return string(resultJSON), nil
}
