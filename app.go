package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// App struct
type App struct {
	ctx              context.Context
	mysqlConnManager *MysqlConnectionManager
	redisConnManager *RedisConnectionManager
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		mysqlConnManager: NewMysqlConnectionManager(),
		redisConnManager: NewRedisConnectionManager(),
	}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fmt.Println("Application started")
}

// shutdown is called at application shutdown
func (a *App) shutdown(ctx context.Context) {
	a.mysqlConnManager.CloseAll()
	a.redisConnManager.CloseAll()
	fmt.Println("Application shutdown")
}

// GetConfigDir returns the configuration directory path
func (a *App) getConfigDir() (string, error) {
	configHome, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	configDir := filepath.Join(configHome, "multi-database-browsing")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", err
	}
	return configDir, nil
}

// LoadState loads application state from file
func (a *App) LoadState() (string, error) {
	configDir, err := a.getConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get config dir: %w", err)
	}

	stateFile := filepath.Join(configDir, "multi-database-browsing.state.json")
	data, err := os.ReadFile(stateFile)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty state if file doesn't exist yet
			return `{"profiles":[],"secrets":{},"history":[]}`, nil
		}
		return "", fmt.Errorf("failed to read state file: %w", err)
	}

	return string(data), nil
}

// SaveState saves application state to file
func (a *App) SaveState(data string) error {
	configDir, err := a.getConfigDir()
	if err != nil {
		return fmt.Errorf("failed to get config dir: %w", err)
	}

	stateFile := filepath.Join(configDir, "multi-database-browsing.state.json")
	if err := os.WriteFile(stateFile, []byte(data), 0644); err != nil {
		return fmt.Errorf("failed to write state file: %w", err)
	}

	return nil
}
