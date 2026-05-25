package mysql

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"

	goMySQL "github.com/go-sql-driver/mysql"
)

// setupTLS configures TLS for the MySQL connection based on request parameters.
// For "custom" mode, it registers a unique TLS config and returns the key.
// For built-in modes, it uses go-sql-driver's predefined TLS configs.
func setupTLS(req *MysqlConnectRequest) (string, error) {
	switch req.TlsMode {
	case "":
		// No TLS
		return "", nil
	case "required":
		// go-sql-driver's "true" = TLS required, verify CA and hostname
		return "true", nil
	case "verify_ca":
		// "skip-verify" = TLS required, verify CA but skip hostname check
		return "skip-verify", nil
	case "verify_identity":
		// "true" = TLS required, verify CA and hostname
		return "true", nil
	case "custom":
		return setupCustomTLS(req)
	default:
		return "", fmt.Errorf("unknown TLS mode: %s", req.TlsMode)
	}
}

// setupCustomTLS builds a custom tls.Config from provided certificates and
// registers it with go-sql-driver under a unique key.
func setupCustomTLS(req *MysqlConnectRequest) (string, error) {
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	// Load CA certificate
	caCertData, err := loadCertOrFile(req.TlsCaCertPem, req.TlsCaCertPath)
	if err != nil {
		return "", fmt.Errorf("failed to load CA certificate: %w", err)
	}
	if caCertData != nil {
		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCertData) {
			return "", fmt.Errorf("failed to parse CA certificate")
		}
		tlsConfig.RootCAs = caCertPool
	}

	// Load client certificate and key
	certData, err := loadCertOrFile(req.TlsClientCertPem, req.TlsClientCertPath)
	if err != nil {
		return "", fmt.Errorf("failed to load client certificate: %w", err)
	}
	keyData, err := loadCertOrFile(req.TlsClientKeyPem, req.TlsClientKeyPath)
	if err != nil {
		return "", fmt.Errorf("failed to load client key: %w", err)
	}
	if certData != nil && keyData != nil {
		cert, err := tls.X509KeyPair(certData, keyData)
		if err != nil {
			return "", fmt.Errorf("failed to parse client certificate/key pair: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	} else if certData != nil || keyData != nil {
		return "", fmt.Errorf("both client certificate and key are required for custom TLS")
	}

	// Register the custom TLS config under a unique key
	configKey := "mdb-custom-" + req.ConnectionID
	if err := goMySQL.RegisterTLSConfig(configKey, tlsConfig); err != nil {
		return "", fmt.Errorf("failed to register custom TLS config: %w", err)
	}

	return configKey, nil
}

// loadCertOrFile returns certificate data from inline PEM or file path.
// Returns nil if both are empty.
func loadCertOrFile(pem, path string) ([]byte, error) {
	if pem != "" {
		return []byte(pem), nil
	}
	if path != "" {
		return os.ReadFile(path)
	}
	return nil, nil
}
