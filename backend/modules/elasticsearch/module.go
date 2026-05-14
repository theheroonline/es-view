package elasticsearch

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"multi-database-browsing/backend/shared"
)

type Module struct{}

func NewModule() *Module {
	return &Module{}
}

func (m *Module) HttpRequest(params HttpRequestParams) (string, error) {
	client := &http.Client{}

	var bodyReader io.Reader
	if params.Body != "" {
		bodyReader = bytes.NewReader([]byte(params.Body))
	}

	req, err := http.NewRequest(params.Method, params.URL, bodyReader)
	if err != nil {
		return "", shared.NewAppError(shared.ErrConnectionFailed, "failed to create request: "+err.Error(), "elasticsearch")
	}

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
		shared.Logger.Error("elasticsearch HTTP request failed",
			slog.String("method", params.Method),
			slog.String("url", params.URL),
			slog.Any("error", err))
		return "", shared.NewAppError(shared.ErrConnectionFailed, "failed to send request: "+err.Error(), "elasticsearch")
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", shared.NewAppError(shared.ErrConnectionFailed, "failed to read response: "+err.Error(), "elasticsearch")
	}

	resultJSON, err := json.Marshal(map[string]interface{}{
		"status": resp.StatusCode,
		"ok":     resp.StatusCode >= 200 && resp.StatusCode < 300,
		"body":   string(respBody),
	})
	if err != nil {
		return "", shared.NewAppError(shared.ErrConnectionFailed, "failed to marshal response: "+err.Error(), "elasticsearch")
	}

	return string(resultJSON), nil
}
