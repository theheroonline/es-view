// Package sshtunnel provides SSH local port forwarding for database connections.
package sshtunnel

import (
	"fmt"
	"io"
	"net"
	"sync"

	"golang.org/x/crypto/ssh"
)

// Config holds SSH connection parameters.
type Config struct {
	Host     string
	Port     int
	Username string
	Password string
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

	sshConfig := &ssh.ClientConfig{
		User: t.cfg.Username,
		Auth: []ssh.AuthMethod{
			ssh.Password(t.cfg.Password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
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
			// Listener closed or error — exit loop.
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
	// Wait for both directions to finish (or one fails and closes the other).
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
// If a tunnel already exists for this ID, it is closed and replaced.
func (m *Manager) GetOrCreate(id string, cfg Config) *Tunnel {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Close existing tunnel if present.
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
