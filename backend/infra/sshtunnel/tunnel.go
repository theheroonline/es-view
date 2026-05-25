// Package sshtunnel provides SSH local port forwarding for database connections.
package sshtunnel

import (
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"

	"github.com/skeema/knownhosts"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

// Config holds SSH connection parameters.
type Config struct {
	Host     string
	Port     int
	Username string
	Password string

	// Key-based authentication
	PrivateKeyPath string // path to private key file
	PrivateKeyPem  string // inline PEM key data
	Passphrase     string // passphrase for encrypted private key

	// SSH agent (Pageant on Windows, ssh-agent on Unix)
	UseAgent bool

	// Host key verification
	HostKeyMode    string // "strict" | "accept-new" | "insecure"
	KnownHostsPath string // path to known_hosts file (empty = auto-detect ~/.ssh/known_hosts)
}

// Tunnel manages a single SSH connection and its local port forwarding listener.
type Tunnel struct {
	mu        sync.Mutex
	cfg       Config
	sshClient *ssh.Client
	listener  net.Listener
	localPort int
	running   bool
}

// NewTunnel creates a new Tunnel with the given config.
func NewTunnel(cfg Config) *Tunnel {
	return &Tunnel{cfg: cfg}
}

// ConnectAndForward establishes the SSH connection and starts a local listener
// that forwards traffic to targetAddr (e.g. "db-host:3306").
// Returns the local port number.
func (t *Tunnel) ConnectAndForward(targetAddr string) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	sshConfig, err := t.buildSSHClientConfig()
	if err != nil {
		return 0, fmt.Errorf("failed to build SSH config: %w", err)
	}

	addr := fmt.Sprintf("%s:%d", t.cfg.Host, t.cfg.Port)
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return 0, fmt.Errorf("ssh dial failed: %w", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		client.Close()
		return 0, fmt.Errorf("failed to create local listener: %w", err)
	}

	localPort := listener.Addr().(*net.TCPAddr).Port

	t.sshClient = client
	t.listener = listener
	t.localPort = localPort
	t.running = true

	go t.forwardLoop(targetAddr)

	return localPort, nil
}

// buildSSHClientConfig constructs an ssh.ClientConfig from the tunnel config.
func (t *Tunnel) buildSSHClientConfig() (*ssh.ClientConfig, error) {
	authMethods, err := t.buildAuthMethods()
	if err != nil {
		return nil, err
	}

	hostKeyCallback, err := t.buildHostKeyCallback()
	if err != nil {
		return nil, err
	}

	return &ssh.ClientConfig{
		User:            t.cfg.Username,
		Auth:            authMethods,
		HostKeyCallback: hostKeyCallback,
	}, nil
}

// buildAuthMethods returns SSH authentication methods based on config.
func (t *Tunnel) buildAuthMethods() ([]ssh.AuthMethod, error) {
	var authMethods []ssh.AuthMethod

	// 1. SSH agent authentication (highest priority if enabled)
	if t.cfg.UseAgent {
		if agentAuth := t.tryAgentAuth(); agentAuth != nil {
			authMethods = append(authMethods, agentAuth)
		}
	}

	// 2. Private key authentication
	if t.cfg.PrivateKeyPath != "" {
		signer, err := t.loadPrivateKeyFromFile()
		if err != nil {
			return nil, fmt.Errorf("failed to load private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	} else if t.cfg.PrivateKeyPem != "" {
		signer, err := t.parsePrivateKeyFromPem()
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	// 3. Password authentication (fallback)
	if t.cfg.Password != "" {
		authMethods = append(authMethods, ssh.Password(t.cfg.Password))
	}

	if len(authMethods) == 0 {
		return nil, fmt.Errorf("no SSH authentication method configured")
	}

	return authMethods, nil
}

// tryAgentAuth attempts to create an SSH agent auth method.
func (t *Tunnel) tryAgentAuth() ssh.AuthMethod {
	// Try unix socket agent first (works on macOS/Linux, and WSL)
	if sock := os.Getenv("SSH_AUTH_SOCK"); sock != "" {
		conn, err := net.Dial("unix", sock)
		if err == nil {
			agentClient := agent.NewClient(conn)
			signers, err := agentClient.Signers()
			if err == nil && len(signers) > 0 {
				return ssh.PublicKeys(signers...)
			}
			conn.Close()
		}
	}

	// On Windows, try ssh-agent via named pipe
	conn, err := net.Dial("unix", `\\.\pipe\openssh-ssh-agent`)
	if err != nil {
		// Also try Pageant
		conn, err = net.Dial("unix", `\\.\pipe\pageant`)
	}
	if err == nil {
		agentClient := agent.NewClient(conn)
		signers, err := agentClient.Signers()
		if err == nil && len(signers) > 0 {
			return ssh.PublicKeys(signers...)
		}
		conn.Close()
	}

	return nil
}

// loadPrivateKeyFromFile loads and parses a private key from a file path.
func (t *Tunnel) loadPrivateKeyFromFile() (ssh.Signer, error) {
	keyData, err := os.ReadFile(t.cfg.PrivateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read key file: %w", err)
	}

	if t.cfg.Passphrase != "" {
		return ssh.ParsePrivateKeyWithPassphrase(keyData, []byte(t.cfg.Passphrase))
	}
	return ssh.ParsePrivateKey(keyData)
}

// parsePrivateKeyFromPem parses a private key from inline PEM data.
func (t *Tunnel) parsePrivateKeyFromPem() (ssh.Signer, error) {
	if t.cfg.Passphrase != "" {
		return ssh.ParsePrivateKeyWithPassphrase([]byte(t.cfg.PrivateKeyPem), []byte(t.cfg.Passphrase))
	}
	return ssh.ParsePrivateKey([]byte(t.cfg.PrivateKeyPem))
}

// buildHostKeyCallback creates a host key verification callback based on config.
func (t *Tunnel) buildHostKeyCallback() (ssh.HostKeyCallback, error) {
	// Insecure mode — backwards compatible with existing behavior
	if t.cfg.HostKeyMode == "insecure" {
		return ssh.InsecureIgnoreHostKey(), nil
	}

	// Resolve known_hosts file path
	khPath := t.cfg.KnownHostsPath
	if khPath == "" {
		khPath = defaultKnownHostsPath()
	}

	// Ensure the known_hosts file and its parent directory exist
	if err := ensureKnownHostsFile(khPath); err != nil {
		return makeAcceptNewHostKeyCallback(khPath), nil
	}

	if t.cfg.HostKeyMode == "accept-new" {
		return makeAcceptNewHostKeyCallback(khPath), nil
	}

	// Strict mode — use skeema/knownhosts for full OpenSSH known_hosts support
	kh, err := knownhosts.New(khPath)
	if err != nil {
		return makeAcceptNewHostKeyCallback(khPath), nil
	}

	return makeStrictHostKeyCallback(kh), nil
}

// makeStrictHostKeyCallback wraps a knownhosts callback with better error messages.
func makeStrictHostKeyCallback(kh knownhosts.HostKeyCallback) ssh.HostKeyCallback {
	baseCallback := kh.HostKeyCallback()
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		err := baseCallback(hostname, remote, key)
		if err != nil {
			if knownhosts.IsHostUnknown(err) {
				return fmt.Errorf("SSH host key verification failed for %s: host not found in known_hosts", hostname)
			}
			if knownhosts.IsHostKeyChanged(err) {
				return fmt.Errorf("SSH host key has CHANGED for %s — possible man-in-the-middle attack! Check your known_hosts file.", hostname)
			}
			return fmt.Errorf("SSH host key verification failed for %s: %w", hostname, err)
		}
		return nil
	}
}

// makeAcceptNewHostKeyCallback accepts unknown hosts but rejects changed keys.
func makeAcceptNewHostKeyCallback(khPath string) ssh.HostKeyCallback {
	kh, err := knownhosts.New(khPath)
	if err != nil {
		return ssh.InsecureIgnoreHostKey()
	}

	baseCallback := kh.HostKeyCallback()
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		err := baseCallback(hostname, remote, key)
		if err == nil {
			return nil
		}

		// Key changed — reject (possible MITM)
		if knownhosts.IsHostKeyChanged(err) {
			return fmt.Errorf("SSH host key has CHANGED for %s — possible man-in-the-middle attack!", hostname)
		}

		// Key not found — accept and store it
		if knownhosts.IsHostUnknown(err) {
			f, openErr := os.OpenFile(khPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
			if openErr != nil {
				return nil // Can't write but allow connection
			}
			defer f.Close()

			line := knownhosts.Line([]string{hostname}, key)
			_, _ = f.WriteString(line + "\n")
			return nil
		}

		return err
	}
}

// defaultKnownHostsPath returns the default path to the user's known_hosts file.
func defaultKnownHostsPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, ".ssh", "known_hosts")
}

// ensureKnownHostsFile creates the known_hosts file and its parent directory if they don't exist.
func ensureKnownHostsFile(path string) error {
	if path == "" {
		return fmt.Errorf("no known_hosts path configured")
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create %s: %w", dir, err)
	}

	if _, err := os.Stat(path); err == nil {
		return nil // already exists
	}

	f, err := os.OpenFile(path, os.O_CREATE, 0600)
	if err != nil {
		return fmt.Errorf("failed to create %s: %w", path, err)
	}
	f.Close()
	return nil
}

// LocalAddr returns the local forwarding address (127.0.0.1:port).
func (t *Tunnel) LocalAddr() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.localPort == 0 {
		return ""
	}
	return fmt.Sprintf("127.0.0.1:%d", t.localPort)
}

// Close shuts down the local listener and SSH connection.
func (t *Tunnel) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.running {
		return nil
	}

	t.running = false

	var errs []error
	if t.listener != nil {
		if err := t.listener.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close listener: %w", err))
		}
	}
	if t.sshClient != nil {
		if err := t.sshClient.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close ssh client: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("tunnel close errors: %v", errs)
	}
	return nil
}

// forwardLoop accepts local connections and forwards each to targetAddr via SSH.
func (t *Tunnel) forwardLoop(targetAddr string) {
	for {
		localConn, err := t.listener.Accept()
		if err != nil {
			return
		}
		go t.pipe(localConn, targetAddr)
	}
}

// pipe connects a local connection to the remote target via SSH and pipes traffic both ways.
func (t *Tunnel) pipe(localConn net.Conn, targetAddr string) {
	defer localConn.Close()

	remoteConn, err := t.sshClient.Dial("tcp", targetAddr)
	if err != nil {
		return
	}
	defer remoteConn.Close()

	done := make(chan struct{})
	go func() {
		_, _ = io.Copy(remoteConn, localConn)
		close(done)
	}()
	go func() {
		_, _ = io.Copy(localConn, remoteConn)
		close(done)
	}()
	<-done
	<-done
}

// Manager manages multiple tunnels keyed by connection ID.
type Manager struct {
	mu      sync.Mutex
	tunnels map[string]*Tunnel
}

// NewManager creates a new Manager.
func NewManager() *Manager {
	return &Manager{tunnels: make(map[string]*Tunnel)}
}

// GetOrCreate returns an existing tunnel for the given ID, or creates a new one.
func (m *Manager) GetOrCreate(id string, cfg Config) *Tunnel {
	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.tunnels[id]; ok {
		_ = existing.Close()
		delete(m.tunnels, id)
	}

	tunnel := NewTunnel(cfg)
	m.tunnels[id] = tunnel
	return tunnel
}

// Close shuts down and removes the tunnel for the given ID.
func (m *Manager) Close(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if tunnel, ok := m.tunnels[id]; ok {
		delete(m.tunnels, id)
		return tunnel.Close()
	}
	return nil
}

// CloseAll shuts down all managed tunnels.
func (m *Manager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, tunnel := range m.tunnels {
		_ = tunnel.Close()
		delete(m.tunnels, id)
	}
}
