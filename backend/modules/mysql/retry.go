package mysql

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

// defaultTimeout is the default timeout for schema-level operations.
const defaultTimeout = 10 * time.Second

// isStaleConnectionError detects MySQL connection-level errors that indicate
// the underlying TCP connection has been severed.
func isStaleConnectionError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	staleMarkers := []string{
		"Error 2006", // MySQL server has gone away
		"Error 2013", // Lost connection to MySQL server during query
		"driver: bad connection",
		"broken pipe",
		"connection reset by peer",
		"connection refused",
		"i/o timeout",
	}
	for _, marker := range staleMarkers {
		if strings.Contains(msg, marker) {
			return true
		}
	}
	return false
}

// queryWithRetry executes db.QueryContext and retries exactly once on stale
// connection errors. If the first call returns rows that must be discarded,
// they are closed before retrying to prevent resource leaks.
func queryWithRetry(db *sql.DB, query string, ctx context.Context) (*sql.Rows, error) {
	rows, err := db.QueryContext(ctx, query)
	if err == nil || !isStaleConnectionError(err) {
		return rows, err
	}
	if rows != nil {
		_ = rows.Close()
	}
	return db.QueryContext(ctx, query)
}

// execWithRetry executes db.ExecContext and retries exactly once on stale
// connection errors.
func execWithRetry(db *sql.DB, query string, ctx context.Context) (sql.Result, error) {
	result, err := db.ExecContext(ctx, query)
	if err == nil || !isStaleConnectionError(err) {
		return result, err
	}
	return db.ExecContext(ctx, query)
}
