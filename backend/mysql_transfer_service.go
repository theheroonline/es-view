package backend

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type MysqlTransferService struct {
	module *MysqlModule
}

func NewMysqlTransferService(module *MysqlModule) *MysqlTransferService {
	return &MysqlTransferService{module: module}
}

func (s *MysqlTransferService) ExportDatabase(ctx context.Context, req MysqlExportRequest) (string, error) {
	if req.ConnectionID == "" || req.Database == "" {
		return "", fmt.Errorf("connectionId and database are required")
	}

	db, err := s.getConnectionDB(req.ConnectionID)
	if err != nil {
		return "", err
	}

	dump, err := s.buildDatabaseDump(db, req.Database, req.IncludeData)
	if err != nil {
		return "", err
	}

	path, err := s.saveDumpToFile(ctx, fmt.Sprintf("%s.sql", req.Database), dump)
	if err != nil || path == "" {
		return "", err
	}

	return fmt.Sprintf("Exported SQL to %s", path), nil
}

func (s *MysqlTransferService) ExportTable(ctx context.Context, req MysqlExportRequest) (string, error) {
	if req.ConnectionID == "" || req.Database == "" || req.Table == "" {
		return "", fmt.Errorf("connectionId, database and tableName are required")
	}

	db, err := s.getConnectionDB(req.ConnectionID)
	if err != nil {
		return "", err
	}

	dump, err := s.buildTableDump(db, req.Database, req.Table, req.IncludeData)
	if err != nil {
		return "", err
	}

	path, err := s.saveDumpToFile(ctx, fmt.Sprintf("%s.%s.sql", req.Database, req.Table), dump)
	if err != nil || path == "" {
		return "", err
	}

	return fmt.Sprintf("Exported SQL to %s", path), nil
}

func (s *MysqlTransferService) ExportTables(ctx context.Context, req MysqlExportRequest) (string, error) {
	if req.ConnectionID == "" || req.Database == "" || len(req.Tables) == 0 {
		return "", fmt.Errorf("connectionId, database and tableNames are required")
	}

	db, err := s.getConnectionDB(req.ConnectionID)
	if err != nil {
		return "", err
	}

	dump, err := s.buildSelectedTablesDump(db, req.Database, req.Tables, req.IncludeData)
	if err != nil {
		return "", err
	}

	path, err := s.saveDumpToFile(ctx, fmt.Sprintf("%s.%d-tables.sql", req.Database, len(req.Tables)), dump)
	if err != nil || path == "" {
		return "", err
	}

	return fmt.Sprintf("Exported %d tables to %s", len(req.Tables), path), nil
}

func (s *MysqlTransferService) ImportSQL(ctx context.Context, req MysqlImportSqlRequest) (string, error) {
	// Fixed: Added input validation
	if req.ConnectionID == "" {
		return "", fmt.Errorf("connectionId is required for import operation")
	}

	selectedFile, err := runtime.OpenFileDialog(ctx, runtime.OpenDialogOptions{
		Title: "Import MySQL SQL",
		Filters: []runtime.FileFilter{{
			DisplayName: "SQL Files (*.sql)",
			Pattern:     "*.sql",
		}},
	})
	if err != nil || selectedFile == "" {
		return "", err
	}

	// Fixed: Added file size limit (50MB) to prevent memory overflow
	const maxFileSize = 50 * 1024 * 1024 // 50MB
	fileInfo, err := os.Stat(selectedFile)
	if err != nil {
		return "", fmt.Errorf("failed to read file info: %w", err)
	}
	if fileInfo.Size() > maxFileSize {
		return "", fmt.Errorf("SQL file size (%d bytes) exceeds maximum allowed size of %d bytes", fileInfo.Size(), maxFileSize)
	}

	content, err := os.ReadFile(selectedFile)
	if err != nil {
		return "", fmt.Errorf("failed to read SQL file: %w", err)
	}

	statements := splitMysqlStatements(string(content))
	if len(statements) == 0 {
		return "", fmt.Errorf("no SQL statements found in file")
	}

	// Fixed: Added statement count limit to prevent excessive operations
	const maxStatements = 10000
	if len(statements) > maxStatements {
		return "", fmt.Errorf("file contains %d statements, exceeds maximum of %d", len(statements), maxStatements)
	}

	db, err := s.getConnectionDB(req.ConnectionID)
	if err != nil {
		return "", err
	}

	conn, err := db.Conn(context.Background())
	if err != nil {
		return "", fmt.Errorf("failed to open dedicated connection: %w", err)
	}
	defer conn.Close()

	if req.Database != "" {
		if _, err := conn.ExecContext(context.Background(), fmt.Sprintf("USE %s", escapeMysqlIdentifier(req.Database))); err != nil {
			return "", fmt.Errorf("failed to switch database: %w", err)
		}
	}

	if _, err := conn.ExecContext(context.Background(), "SET FOREIGN_KEY_CHECKS=0"); err != nil {
		return "", fmt.Errorf("failed to disable foreign key checks: %w", err)
	}
	defer conn.ExecContext(context.Background(), "SET FOREIGN_KEY_CHECKS=1")

	executed := 0
	for i, statement := range statements {
		if !shouldExecuteMysqlStatement(statement) {
			continue
		}
		if _, err := conn.ExecContext(context.Background(), statement); err != nil {
			return "", fmt.Errorf("failed to execute statement %d/%d: %w", i+1, len(statements), err)
		}
		executed++
	}

	if executed == 0 {
		return "", fmt.Errorf("no executable SQL statements found in file")
	}

	return fmt.Sprintf("Imported %d statements from %s", executed, filepath.Base(selectedFile)), nil
}

func (s *MysqlTransferService) getConnectionDB(connectionID string) (*sql.DB, error) {
	s.module.connManager.mu.RLock()
	db, exists := s.module.connManager.connections[connectionID]
	s.module.connManager.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}
	return db, nil
}

func (s *MysqlTransferService) saveDumpToFile(ctx context.Context, defaultName, content string) (string, error) {
	selectedFile, err := runtime.SaveFileDialog(ctx, runtime.SaveDialogOptions{
		Title:           "Save SQL File",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{{
			DisplayName: "SQL Files (*.sql)",
			Pattern:     "*.sql",
		}},
	})
	if err != nil {
		return "", fmt.Errorf("failed to open save dialog: %w", err)
	}
	if selectedFile == "" {
		return "", nil
	}

	if filepath.Ext(selectedFile) == "" {
		selectedFile += ".sql"
	}

	if err := os.WriteFile(selectedFile, []byte(content), 0o644); err != nil {
		return "", fmt.Errorf("failed to write SQL file: %w", err)
	}

	return selectedFile, nil
}
