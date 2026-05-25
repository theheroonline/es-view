package state_store

import (
	"fmt"
	"os"
	"path/filepath"
)

type AppStateStore struct {
	appName string
}

func NewAppStateStore(appName string) *AppStateStore {
	return &AppStateStore{appName: appName}
}

func (s *AppStateStore) getConfigDir() (string, error) {
	configHome, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	configDir := filepath.Join(configHome, s.appName)
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return "", err
	}

	return configDir, nil
}

func (s *AppStateStore) LoadState() (string, error) {
	configDir, err := s.getConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get config dir: %w", err)
	}

	stateFile := filepath.Join(configDir, s.appName+".state.json")
	data, err := os.ReadFile(stateFile)
	if err != nil {
		if os.IsNotExist(err) {
			return `{"profiles":[],"secrets":{}}`, nil
		}
		return "", fmt.Errorf("failed to read state file: %w", err)
	}

	return string(data), nil
}

func (s *AppStateStore) SaveState(data string) error {
	configDir, err := s.getConfigDir()
	if err != nil {
		return fmt.Errorf("failed to get config dir: %w", err)
	}

	stateFile := filepath.Join(configDir, s.appName+".state.json")
	if err := os.WriteFile(stateFile, []byte(data), 0o644); err != nil {
		return fmt.Errorf("failed to write state file: %w", err)
	}

	return nil
}
