package elasticsearch

import (
	"crypto/tls"
	"crypto/x509"
	"net/http"
	"os"
)

// buildEsHTTPClient creates an http.Client with TLS configuration based on request parameters.
func buildEsHTTPClient(params *HttpRequestParams) *http.Client {
	tlsConfig := buildEsTLSConfig(params)
	if tlsConfig == nil {
		return &http.Client{}
	}
	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		},
	}
}

// buildEsTLSConfig returns a *tls.Config based on the request parameters, or nil.
func buildEsTLSConfig(params *HttpRequestParams) *tls.Config {
	switch params.TlsMode {
	case "":
		// Use VerifyTls legacy field for backwards compat
		if !params.VerifyTls {
			return &tls.Config{
				InsecureSkipVerify: true,
			}
		}
		return nil
	case "required":
		return &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: false,
		}
	case "verify_ca":
		return &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: true,
		}
	case "verify_identity":
		return &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: false,
		}
	case "custom":
		return buildCustomEsTLSConfig(params)
	default:
		// Fallback: respect VerifyTls
		if !params.VerifyTls {
			return &tls.Config{
				InsecureSkipVerify: true,
			}
		}
		return nil
	}
}

// buildCustomEsTLSConfig builds a custom tls.Config from provided certificates.
func buildCustomEsTLSConfig(params *HttpRequestParams) *tls.Config {
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	// Load CA certificate
	caCertData, err := loadEsCertOrFile(params.TlsCaCertPem, params.TlsCaCertPath)
	if err != nil {
		return nil
	}
	if caCertData != nil {
		caCertPool := x509.NewCertPool()
		if caCertPool.AppendCertsFromPEM(caCertData) {
			tlsConfig.RootCAs = caCertPool
		}
	}

	// Load client certificate and key
	certData, err := loadEsCertOrFile(params.TlsClientCertPem, params.TlsClientCertPath)
	if err != nil {
		return nil
	}
	keyData, err := loadEsCertOrFile(params.TlsClientKeyPem, params.TlsClientKeyPath)
	if err != nil {
		return nil
	}
	if certData != nil && keyData != nil {
		cert, err := tls.X509KeyPair(certData, keyData)
		if err == nil {
			tlsConfig.Certificates = []tls.Certificate{cert}
		}
	}

	return tlsConfig
}

// loadEsCertOrFile returns certificate data from inline PEM or file path.
func loadEsCertOrFile(pem, path string) ([]byte, error) {
	if pem != "" {
		return []byte(pem), nil
	}
	if path != "" {
		return os.ReadFile(path)
	}
	return nil, nil
}
