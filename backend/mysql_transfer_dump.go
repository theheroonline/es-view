package backend

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

func escapeMysqlIdentifier(name string) string {
	return "`" + strings.ReplaceAll(name, "`", "``") + "`"
}

func escapeMysqlLiteral(value string) string {
	escaped := strings.ReplaceAll(value, "'", "''")
	return "'" + escaped + "'"
}

func (s *MysqlTransferService) buildDatabaseDump(db *sql.DB, database string, includeData bool) (string, error) {
	rows, err := db.Query(fmt.Sprintf("SHOW TABLES FROM %s", escapeMysqlIdentifier(database)))
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

func (s *MysqlTransferService) buildTableDump(db *sql.DB, database, table string, includeData bool) (string, error) {
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

func (s *MysqlTransferService) buildSelectedTablesDump(db *sql.DB, database string, tables []string, includeData bool) (string, error) {
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

func (s *MysqlTransferService) readCreateTableSQL(db *sql.DB, database, table string) (string, error) {
	query := fmt.Sprintf("SHOW CREATE TABLE %s.%s", escapeMysqlIdentifier(database), escapeMysqlIdentifier(table))
	rows, err := db.Query(query)
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

func (s *MysqlTransferService) buildTableDataDump(db *sql.DB, database, table string) (string, error) {
	// Fixed: Added row limit to prevent memory overflow when exporting large tables
	const maxExportRows = 1000000 // 1 million rows max per table

	query := fmt.Sprintf("SELECT * FROM %s.%s", escapeMysqlIdentifier(database), escapeMysqlIdentifier(table))
	rows, err := db.Query(query)
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

	rowCount := 0
	for rows.Next() {
		if rowCount >= maxExportRows {
			return "", fmt.Errorf("table %s.%s exceeds export limit of %d rows; consider exporting in smaller batches", database, table, maxExportRows)
		}

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
		rowCount++
	}

	if err := rows.Err(); err != nil {
		return "", err
	}

	return builder.String(), nil
}

func formatMysqlValue(value any) string {
	if value == nil {
		return "NULL"
	}

	switch typed := value.(type) {
	case []byte:
		if utf8.Valid(typed) {
			return escapeMysqlLiteral(BytesToString(typed))
		}
		return fmt.Sprintf("x'%x'", typed)
	case string:
		return escapeMysqlLiteral(typed)
	case time.Time:
		return escapeMysqlLiteral(typed.Format("2006-01-02 15:04:05.999999"))
	case bool:
		if typed {
			return "1"
		}
		return "0"
	default:
		return escapeMysqlLiteral(fmt.Sprint(typed))
	}
}
