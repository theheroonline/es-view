package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

func (m *Module) MysqlQuery(connectionID string, query string) (MysqlQueryResult, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return MysqlQueryResult{}, fmt.Errorf("connection not found: %s", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if !isMysqlResultSetQuery(query) {
		execResult, err := db.ExecContext(ctx, query)
		if err != nil {
			return MysqlQueryResult{}, fmt.Errorf("query failed: %w", err)
		}

		affectedRows, err := execResult.RowsAffected()
		if err != nil {
			affectedRows = 0
		}

		return MysqlQueryResult{Columns: []string{}, Rows: [][]interface{}{}, AffectedRows: affectedRows, IsResultSet: false}, nil
	}

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return MysqlQueryResult{}, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return MysqlQueryResult{}, fmt.Errorf("failed to get columns: %w", err)
	}

	result := MysqlQueryResult{Columns: columns, Rows: [][]interface{}{}, IsResultSet: true}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return MysqlQueryResult{}, fmt.Errorf("scan failed: %w", err)
		}

		for i, value := range values {
			values[i] = normalizeMysqlValue(value)
		}

		result.Rows = append(result.Rows, values)
	}

	if err := rows.Err(); err != nil {
		return MysqlQueryResult{}, fmt.Errorf("scan failed: %w", err)
	}

	return result, nil
}

func normalizeMysqlValue(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	switch typed := value.(type) {
	case []byte:
		return string(typed)
	case sql.RawBytes:
		return string(typed)
	default:
		return value
	}
}
