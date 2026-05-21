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
	result, err := execWithRetry(db, query, ctx)
		if err != nil {
			return MysqlQueryResult{}, shared.NewAppError(shared.ErrQueryFailed, "query failed: "+err.Error(), "mysql")
		}

		var affectedRows int64
		if n, err := result.RowsAffected(); err == nil {
			affectedRows = n
		}

		return MysqlQueryResult{Columns: []string{}, Rows: [][]any{}, AffectedRows: affectedRows, IsResultSet: false}, nil
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

	// Build a set of column indices that contain binary data (BLOB, BINARY, VARBINARY, BIT).
	// This allows safe encoding of binary values while leaving text columns untouched.
	binaryCols := make(map[int]bool)
	var columnTypeNames []string
	if columnTypes, err := rows.ColumnTypes(); err == nil {
		columnTypeNames = make([]string, len(columnTypes))
		for i, ct := range columnTypes {
			dbTypeName := ct.DatabaseTypeName()
			columnTypeNames[i] = dbTypeName
			switch dbTypeName {
			case "BLOB", "MEDIUMBLOB", "LONGBLOB", "TINYBLOB", "BINARY", "VARBINARY", "BIT":
				binaryCols[i] = true
			}
		}
	}

	result := MysqlQueryResult{Columns: columns, ColumnTypes: columnTypeNames, Rows: [][]any{}, IsResultSet: true}

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
			values[i] = normalizeMysqlValue(value, binaryCols[i])
		}

		result.Rows = append(result.Rows, values)
	}

	if err := rows.Err(); err != nil {
		return MysqlQueryResult{}, shared.NewAppError(shared.ErrQueryFailed, "scan failed: "+err.Error(), "mysql")
	}

	return result, nil
}

func normalizeMysqlValue(value interface{}, isBinaryCol bool) interface{} {
	if value == nil {
		return nil
	}

	switch typed := value.(type) {
	case []byte:
		safe, enc := shared.SafeStringValue(typed)
		if enc == "base64" || isBinaryCol {
			return shared.BinaryValue{Value: safe, Encoding: enc}
		}
		return safe
	case sql.RawBytes:
		safe, enc := shared.SafeStringValue([]byte(typed))
		if enc == "base64" || isBinaryCol {
			return shared.BinaryValue{Value: safe, Encoding: enc}
		}
		return safe
	default:
		return value
	}
}
