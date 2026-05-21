package elasticsearch

type HttpRequestParams struct {
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	VerifyTls bool              `json:"verifyTls"`
	Auth      *AuthConfig       `json:"auth"`
	// TLS configuration
	TlsMode           string `json:"tlsMode"`
	TlsCaCertPath     string `json:"tlsCaCertPath"`
	TlsCaCertPem      string `json:"tlsCaCertPem"`
	TlsClientCertPath string `json:"tlsClientCertPath"`
	TlsClientCertPem  string `json:"tlsClientCertPem"`
	TlsClientKeyPath  string `json:"tlsClientKeyPath"`
	TlsClientKeyPem   string `json:"tlsClientKeyPem"`
}

type AuthConfig struct {
	AuthType string `json:"authType"`
	Username string `json:"username"`
	Password string `json:"password"`
	ApiKey   string `json:"apiKey"`
}
