package backend

import "fmt"

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
	if a.elasticsearch == nil {
		return "", fmt.Errorf("elasticsearch module is not initialized")
	}

	return a.elasticsearch.HttpRequest(params)
}
