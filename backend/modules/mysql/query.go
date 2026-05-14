package mysql

import (
	"context"
	"database/sql"
	"time"

	"multi-database-browsing/backend/shared"
)

func (m *Module) MysqlQuery(connectionID string, query string) (MysqlQueryResult, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return MysqlQueryResult{}, shared.NewConnectionFailed("mysql", "connection not found: "+connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if !isMysqlResultSetQuery(query) {
		_, err := execWithRetry(db, query, ctx)
		if err != nil {
			return MysqlQueryResult{}, shared.NewAppError(shared.ErrQueryFailed, "query failed: "+err.Error(), "mysql")
		}

		return MysqlQueryResult{Columns: []string{}, Rows: [][]any{}, AffectedRows: 0, IsResultSet: false}, nil
	}

	rows, err := queryWithRetry(db, query, ctx)
	if err != nil {
		return MysqlQueryResult{}, shared.NewAppError(shared.ErrQueryFailed, "query failed: "+err.Error(), "mysql")
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return MysqlQueryResult{}, shared.NewAppError(shared.ErrQueryFailed, "failed to get columns: "+err.Error(), "mysql")
	}

	result := MysqlQueryResult{Columns: columns, Rows: [][]any{}, IsResultSet: true}

	for rows.Next() {
		values := make([]any, len(columns))
		valuePtrs := make([]any, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return MysqlQueryResult{}, shared.NewAppError(shared.ErrQueryFailed, "scan failed: "+err.Error(), "mysql")
		}

		for i, value := range values {
			values[i] = normalizeMysqlValue(value)
		}

		result.Rows = append(result.Rows, values)
	}

	if err := rows.Err(); err != nil {
		return MysqlQueryResult{}, shared.NewAppError(shared.ErrQueryFailed, "scan failed: "+err.Error(), "mysql")
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
