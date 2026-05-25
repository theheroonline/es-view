package elasticsearch

type HttpRequestParams struct {
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	VerifyTls bool              `json:"verifyTls"`
	Auth      *AuthConfig       `json:"auth"`
}

type AuthConfig struct {
	AuthType string `json:"authType"`
	Username string `json:"username"`
	Password string `json:"password"`
	ApiKey   string `json:"apiKey"`
}
