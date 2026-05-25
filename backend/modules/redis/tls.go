package redis

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
)

// setupRedisTLS configures TLS for a Redis connection based on request parameters.
// Returns a *tls.Config or nil.
func setupRedisTLS(req *RedisConnectRequest) (*tls.Config, error) {
	switch req.TlsMode {
	case "":
		return nil, nil
	case "required":
		return &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: false,
		}, nil
	case "verify_ca":
		return &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: true, // verify CA but skip hostname
		}, nil
	case "verify_identity":
		return &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: false,
		}, nil
	case "custom":
		return setupCustomRedisTLS(req)
	default:
		return nil, fmt.Errorf("unknown TLS mode: %s", req.TlsMode)
	}
}

// setupCustomRedisTLS builds a custom tls.Config from provided certificates.
func setupCustomRedisTLS(req *RedisConnectRequest) (*tls.Config, error) {
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	// Load CA certificate
	caCertData, err := loadRedisCertOrFile(req.TlsCaCertPem, req.TlsCaCertPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load CA certificate: %w", err)
	}
	if caCertData != nil {
		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCertData) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}
		tlsConfig.RootCAs = caCertPool
	}

	// Load client certificate and key
	certData, err := loadRedisCertOrFile(req.TlsClientCertPem, req.TlsClientCertPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load client certificate: %w", err)
	}
	keyData, err := loadRedisCertOrFile(req.TlsClientKeyPem, req.TlsClientKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load client key: %w", err)
	}
	if certData != nil && keyData != nil {
		cert, err := tls.X509KeyPair(certData, keyData)
		if err != nil {
			return nil, fmt.Errorf("failed to parse client certificate/key pair: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	} else if certData != nil || keyData != nil {
		return nil, fmt.Errorf("both client certificate and key are required for custom TLS")
	}

	return tlsConfig, nil
}

// loadRedisCertOrFile returns certificate data from inline PEM or file path.
func loadRedisCertOrFile(pem, path string) ([]byte, error) {
	if pem != "" {
		return []byte(pem), nil
	}
	if path != "" {
		return os.ReadFile(path)
	}
	return nil, nil
}
