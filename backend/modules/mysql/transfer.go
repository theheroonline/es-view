package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (m *Module) MysqlExportDatabase(ctx context.Context, req MysqlExportRequest) (string, error) {
	return m.transfer.ExportDatabase(ctx, req)
}

func (m *Module) MysqlExportTable(ctx context.Context, req MysqlExportRequest) (string, error) {
	return m.transfer.ExportTable(ctx, req)
}

func (m *Module) MysqlExportTables(ctx context.Context, req MysqlExportRequest) (string, error) {
	return m.transfer.ExportTables(ctx, req)
}

func (m *Module) MysqlImportSql(ctx context.Context, req MysqlImportSqlRequest) (string, error) {
	return m.transfer.ImportSQL(ctx, req)
}

type TransferService struct {
	module *Module
}

func NewTransferService(module *Module) *TransferService {
	return &TransferService{module: module}
}

func (s *TransferService) ExportDatabase(ctx context.Context, req MysqlExportRequest) (string, error) {
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

func (s *TransferService) ExportTable(ctx context.Context, req MysqlExportRequest) (string, error) {
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

func (s *TransferService) ExportTables(ctx context.Context, req MysqlExportRequest) (string, error) {
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

func (s *TransferService) ImportSQL(ctx context.Context, req MysqlImportSqlRequest) (string, error) {
	if req.ConnectionID == "" {
		return "", fmt.Errorf("connectionId is required")
	}

	selectedFile, err := runtime.OpenFileDialog(ctx, runtime.OpenDialogOptions{Title: "Import MySQL SQL", Filters: []runtime.FileFilter{{DisplayName: "SQL Files (*.sql)", Pattern: "*.sql"}}})
	if err != nil || selectedFile == "" {
		return "", err
	}

	content, err := os.ReadFile(selectedFile)
	if err != nil {
		return "", fmt.Errorf("failed to read SQL file: %w", err)
	}

	statements := splitMysqlStatements(string(content))
	if len(statements) == 0 {
		return "", fmt.Errorf("no SQL statements found in file")
	}

	db, err := s.getConnectionDB(req.ConnectionID)
	if err != nil {
		return "", err
	}

	conn, err := db.Conn(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to open dedicated connection: %w", err)
	}
	defer conn.Close()

	if req.Database != "" {
		if _, err := conn.ExecContext(ctx, fmt.Sprintf("USE %s", escapeMysqlIdentifier(req.Database))); err != nil {
			return "", fmt.Errorf("failed to switch database: %w", err)
		}
	}

	if _, err := conn.ExecContext(ctx, "SET FOREIGN_KEY_CHECKS=0"); err != nil {
		return "", fmt.Errorf("failed to disable foreign key checks: %w", err)
	}
	defer conn.ExecContext(ctx, "SET FOREIGN_KEY_CHECKS=1")

	executed := 0
	for _, statement := range statements {
		if !shouldExecuteMysqlStatement(statement) {
			continue
		}
		if _, err := conn.ExecContext(ctx, statement); err != nil {
			return "", fmt.Errorf("failed to execute statement %d: %w", executed+1, err)
		}
		executed++
	}

	if executed == 0 {
		return "", fmt.Errorf("no executable SQL statements found in file")
	}

	return fmt.Sprintf("Imported %d statements from %s", executed, filepath.Base(selectedFile)), nil
}

func (s *TransferService) getConnectionDB(connectionID string) (*sql.DB, error) {
	s.module.connManager.mu.RLock()
	db, exists := s.module.connManager.connections[connectionID]
	s.module.connManager.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}
	return db, nil
}

func (s *TransferService) saveDumpToFile(ctx context.Context, defaultName, content string) (string, error) {
	selectedFile, err := runtime.SaveFileDialog(ctx, runtime.SaveDialogOptions{Title: "Save SQL File", DefaultFilename: defaultName, Filters: []runtime.FileFilter{{DisplayName: "SQL Files (*.sql)", Pattern: "*.sql"}}})
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

func (s *TransferService) buildDatabaseDump(db *sql.DB, database string, includeData bool) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	rows, err := db.QueryContext(ctx, fmt.Sprintf("SHOW TABLES FROM %s", escapeMysqlIdentifier(database)))
	cancel()
	if err != nil {
		return "", fmt.Errorf("failed to get tables: %w", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return "", fmt.Errorf("failed to scan table name: %w", err)
		}
		tables = append(tables, tableName)
	}
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("failed to iterate table names: %w", err)
	}

	var builder strings.Builder
	builder.WriteString("-- Multi-Database-Browsing MySQL export\n")
	builder.WriteString("SET FOREIGN_KEY_CHECKS=0;\n")
	builder.WriteString(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s;\n", escapeMysqlIdentifier(database)))
	builder.WriteString(fmt.Sprintf("USE %s;\n\n", escapeMysqlIdentifier(database)))

	for _, table := range tables {
		createSQL, err := s.readCreateTableSQL(db, database, table)
		if err != nil {
			return "", fmt.Errorf("failed to export table %s: %w", table, err)
		}

		builder.WriteString(fmt.Sprintf("-- Table: %s\n", table))
		builder.WriteString(createSQL)

		if includeData {
			dataSQL, err := s.buildTableDataDump(db, database, table)
			if err != nil {
				return "", fmt.Errorf("failed to export table data %s: %w", table, err)
			}
			if dataSQL != "" {
				builder.WriteString(dataSQL)
			}
		}

		builder.WriteString("\n")
	}

	builder.WriteString("SET FOREIGN_KEY_CHECKS=1;\n")
	return builder.String(), nil
}

func (s *TransferService) buildTableDump(db *sql.DB, database, table string, includeData bool) (string, error) {
	createSQL, err := s.readCreateTableSQL(db, database, table)
	if err != nil {
		return "", fmt.Errorf("failed to export table schema: %w", err)
	}

	var builder strings.Builder
	builder.WriteString("-- Multi-Database-Browsing MySQL table export\n")
	builder.WriteString("SET FOREIGN_KEY_CHECKS=0;\n")
	builder.WriteString(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s;\n", escapeMysqlIdentifier(database)))
	builder.WriteString(fmt.Sprintf("USE %s;\n\n", escapeMysqlIdentifier(database)))
	builder.WriteString(createSQL)

	if includeData {
		dataSQL, err := s.buildTableDataDump(db, database, table)
		if err != nil {
			return "", fmt.Errorf("failed to export table data: %w", err)
		}
		if dataSQL != "" {
			builder.WriteString(dataSQL)
		}
	}

	builder.WriteString("\nSET FOREIGN_KEY_CHECKS=1;\n")
	return builder.String(), nil
}

func (s *TransferService) buildSelectedTablesDump(db *sql.DB, database string, tables []string, includeData bool) (string, error) {
	var builder strings.Builder
	builder.WriteString("-- Multi-Database-Browsing MySQL selected tables export\n")
	builder.WriteString("SET FOREIGN_KEY_CHECKS=0;\n")
	builder.WriteString(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s;\n", escapeMysqlIdentifier(database)))
	builder.WriteString(fmt.Sprintf("USE %s;\n\n", escapeMysqlIdentifier(database)))

	for _, table := range tables {
		createSQL, err := s.readCreateTableSQL(db, database, table)
		if err != nil {
			return "", err
		}

		builder.WriteString(fmt.Sprintf("-- Table: %s\n", table))
		builder.WriteString(createSQL)

		if !includeData {
			builder.WriteString("\n")
			continue
		}

		dataSQL, err := s.buildTableDataDump(db, database, table)
		if err != nil {
			return "", err
		}
		if dataSQL != "" {
			builder.WriteString(dataSQL)
		}
		builder.WriteString("\n")
	}

	builder.WriteString("SET FOREIGN_KEY_CHECKS=1;\n")
	return builder.String(), nil
}

func (s *TransferService) readCreateTableSQL(db *sql.DB, database, table string) (string, error) {
	query := fmt.Sprintf("SHOW CREATE TABLE %s.%s", escapeMysqlIdentifier(database), escapeMysqlIdentifier(table))
	rows, err := db.QueryContext(context.Background(), query)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	columns, data, err := scanRowsToNullStringMaps(rows)
	if err != nil {
		return "", err
	}
	if len(data) == 0 {
		return "", sql.ErrNoRows
	}

	createSQL := getNullStringValueByIndex(columns, data[0], 1)
	if !createSQL.Valid {
		return "", fmt.Errorf("missing CREATE TABLE statement in SHOW CREATE TABLE result")
	}

	return fmt.Sprintf("DROP TABLE IF EXISTS %s;\n%s;\n", escapeMysqlIdentifier(table), createSQL.String), nil
}

func (s *TransferService) buildTableDataDump(db *sql.DB, database, table string) (string, error) {
	query := fmt.Sprintf("SELECT * FROM %s.%s", escapeMysqlIdentifier(database), escapeMysqlIdentifier(table))
	rows, err := db.QueryContext(context.Background(), query)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return "", err
	}

	columnList := make([]string, 0, len(columns))
	for _, column := range columns {
		columnList = append(columnList, escapeMysqlIdentifier(column))
	}

	var builder strings.Builder
	values := make([]any, len(columns))
	valueRefs := make([]any, len(columns))
	for index := range values {
		valueRefs[index] = &values[index]
	}

	for rows.Next() {
		if err := rows.Scan(valueRefs...); err != nil {
			return "", err
		}

		serialized := make([]string, 0, len(values))
		for _, value := range values {
			serialized = append(serialized, formatMysqlValue(value))
		}

		builder.WriteString("INSERT INTO ")
		builder.WriteString(escapeMysqlIdentifier(table))
		builder.WriteString(" (")
		builder.WriteString(strings.Join(columnList, ", "))
		builder.WriteString(") VALUES (")
		builder.WriteString(strings.Join(serialized, ", "))
		builder.WriteString(");\n")
	}

	if err := rows.Err(); err != nil {
		return "", err
	}

	return builder.String(), nil
}
