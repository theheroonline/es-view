package backend

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"
)

func (m *ElasticsearchModule) HttpRequest(params HttpRequestParams) (string, error) {
	// Fixed: Added request size limit to prevent memory overflow
	const maxRequestSize = 100 * 1024 * 1024 // 100MB max request body
	const maxResponseSize = 500 * 1024 * 1024 // 500MB max response body
	const requestTimeout = 30 * time.Second    // 30s request timeout

	if params.Body != "" && len(params.Body) > maxRequestSize {
		return "", fmt.Errorf("request body size (%d bytes) exceeds maximum allowed size of %d bytes", len(params.Body), maxRequestSize)
	}

	var bodyReader io.Reader
	if params.Body != "" {
		bodyReader = bytes.NewReader([]byte(params.Body))
	}

	// Fixed: Added proper timeout configuration
	client := &http.Client{
		Timeout: requestTimeout,
		Transport: &http.Transport{
			// Fixed: Improved TLS configuration with proper certificate verification
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: !params.VerifyTls, // Respect TLS verification setting
				MinVersion:        tls.VersionTLS12,  // Require TLS 1.2 or higher
			},
			// Connection pooling configuration
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 100,
			MaxConnsPerHost:     100,
			IdleConnTimeout:     90 * time.Second,
			DialContext: (&net.Dialer{
				Timeout:   10 * time.Second,
				KeepAlive: 90 * time.Second,
			}).DialContext,
		},
	}

	req, err := http.NewRequest(params.Method, params.URL, bodyReader)
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Fixed: Added request context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
	defer cancel()
	req = req.WithContext(ctx)

	req.Header.Set("Content-Type", "application/json")
	for key, value := range params.Headers {
		req.Header.Set(key, value)
	}

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
		return "", fmt.Errorf("failed to send HTTP request to %s: %w", params.URL, err)
	}
	defer resp.Body.Close()

	// Fixed: Added response size limit to prevent memory overflow
	limitedReader := io.LimitReader(resp.Body, maxResponseSize)
	respBody, err := io.ReadAll(limitedReader)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if response was truncated due to size limit
	if len(respBody) >= maxResponseSize {
		return "", fmt.Errorf("response body size exceeds maximum allowed size of %d bytes; response may be incomplete", maxResponseSize)
	}

	// Fixed: Improved error information with response status and URL
	resultJSON, err := json.Marshal(map[string]interface{}{
		"status": resp.StatusCode,
		"ok":     resp.StatusCode >= 200 && resp.StatusCode < 300,
		"body":   string(respBody),
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal response JSON from %s (status %d): %w", params.URL, resp.StatusCode, err)
	}

	return string(resultJSON), nil
}
