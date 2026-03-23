package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strconv"
	"time"

	goMySQL "github.com/go-sql-driver/mysql"
)

type Module struct {
	connManager *MysqlConnectionManager
	transfer    *TransferService
}

func NewModule() *Module {
	module := &Module{connManager: NewMysqlConnectionManager()}
	module.transfer = NewTransferService(module)
	return module
}

func (m *Module) CloseAll() {
	m.connManager.CloseAll()
}

func (m *Module) MysqlConnect(req MysqlConnectRequest) (string, error) {
	config := goMySQL.NewConfig()
	config.User = req.Username
	config.Passwd = req.Password
	config.Net = "tcp"
	config.Addr = fmt.Sprintf("%s:%d", req.Host, req.Port)
	config.DBName = req.Database
	config.Params = map[string]string{"charset": "utf8mb4"}
	config.ParseTime = true
	config.Loc = time.Local
	config.Timeout = 3 * time.Second
	config.ReadTimeout = 5 * time.Second
	config.WriteTimeout = 5 * time.Second

	dsn := config.FormatDSN()

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return "", fmt.Errorf("failed to open connection: %w", err)
	}
	db.SetConnMaxLifetime(90 * time.Second)
	db.SetConnMaxIdleTime(60 * time.Second)
	db.SetMaxIdleConns(1)
	db.SetMaxOpenConns(5)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return "", fmt.Errorf("failed to ping database: %w", err)
	}

	m.connManager.mu.Lock()
	defer m.connManager.mu.Unlock()
	if existing, exists := m.connManager.connections[req.ConnectionID]; exists {
		_ = existing.Close()
	}
	m.connManager.connections[req.ConnectionID] = db

	return "Connected successfully", nil
}

func (m *Module) MysqlDisconnect(connectionID string) (string, error) {
	m.connManager.mu.Lock()
	defer m.connManager.mu.Unlock()
	if db, exists := m.connManager.connections[connectionID]; exists {
		err := db.Close()
		delete(m.connManager.connections, connectionID)
		if err != nil {
			return "", fmt.Errorf("failed to close connection: %w", err)
		}
		return "Disconnected successfully", nil
	}
	return "", fmt.Errorf("connection not found: %s", connectionID)
}

func (m *Module) MysqlPing(connectionID string) (string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return "", fmt.Errorf("connection not found: %s", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return "", fmt.Errorf("ping failed: %w", err)
	}
	return "Pong", nil
}

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

		result.Rows = append(result.Rows, values)
	}

	if err := rows.Err(); err != nil {
		return MysqlQueryResult{}, fmt.Errorf("scan failed: %w", err)
	}

	return result, nil
}

func (m *Module) MysqlListDatabases(connectionID string) ([]string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	rows, err := db.Query("SHOW DATABASES")
	if err != nil {
		return nil, fmt.Errorf("failed to list databases: %w", err)
	}
	defer rows.Close()

	columns, data, err := scanRowsToNullStringMaps(rows)
	if err != nil {
		return nil, fmt.Errorf("scan failed: %w", err)
	}

	systemDatabases := map[string]bool{"information_schema": true, "performance_schema": true, "mysql": true, "sys": true}
	databases := make([]string, 0, len(data))
	for _, row := range data {
		dbName := getNullStringValueByIndex(columns, row, 0)
		if dbName.Valid && !systemDatabases[dbName.String] {
			databases = append(databases, dbName.String)
		}
	}

	return databases, nil
}

func (m *Module) MysqlListTables(connectionID string, database string) ([]string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	query := "SHOW TABLES"
	if database != "" {
		query = fmt.Sprintf("SHOW TABLES FROM `%s`", database)
	}

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	defer rows.Close()

	columns, data, err := scanRowsToNullStringMaps(rows)
	if err != nil {
		return nil, fmt.Errorf("scan failed: %w", err)
	}

	tables := make([]string, 0, len(data))
	for _, row := range data {
		tableName := getNullStringValueByIndex(columns, row, 0)
		if tableName.Valid {
			tables = append(tables, tableName.String)
		}
	}

	return tables, nil
}

func (m *Module) MysqlDescribeTable(connectionID string, database string, tableName string) ([]MysqlColumnMeta, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	var query string
	if database != "" {
		query = fmt.Sprintf("DESCRIBE `%s`.`%s`", database, tableName)
	} else {
		query = fmt.Sprintf("DESCRIBE `%s`", tableName)
	}

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to describe table: %w", err)
	}
	defer rows.Close()

	columns := make([]MysqlColumnMeta, 0)
	for rows.Next() {
		var col MysqlColumnMeta
		var defaultVal sql.NullString
		if err := rows.Scan(&col.Field, &col.Type, &col.Null, &col.Key, &defaultVal, &col.Extra); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		if defaultVal.Valid {
			col.Default = &defaultVal.String
		}
		columns = append(columns, col)
	}

	return columns, nil
}

func (m *Module) MysqlListIndexes(req MysqlListIndexesRequest) ([]MysqlIndexMeta, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[req.ConnectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	var query string
	if req.Database != "" {
		query = fmt.Sprintf("SHOW INDEX FROM `%s`.`%s`", req.Database, req.TableName)
	} else {
		query = fmt.Sprintf("SHOW INDEX FROM `%s`", req.TableName)
	}

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list indexes: %w", err)
	}
	defer rows.Close()

	_, data, err := scanRowsToNullStringMaps(rows)
	if err != nil {
		return nil, fmt.Errorf("scan failed: %w", err)
	}

	type indexColumn struct {
		name string
		seq  int
	}

	type indexAccumulator struct {
		meta    MysqlIndexMeta
		columns []indexColumn
	}

	indexMap := make(map[string]*indexAccumulator)
	for _, indexRow := range data {
		nonUnique := getNullStringValue(indexRow, "non_unique")
		keyName := getNullStringValue(indexRow, "key_name")
		columnName := getNullStringValue(indexRow, "column_name")
		indexType := getNullStringValue(indexRow, "index_type")
		seqInIndex := getNullStringValue(indexRow, "seq_in_index")

		if !keyName.Valid {
			continue
		}

		name := keyName.String
		if _, exists := indexMap[name]; !exists {
			indexTypeStr := "BTREE"
			if indexType.Valid {
				indexTypeStr = indexType.String
			}
			indexMap[name] = &indexAccumulator{meta: MysqlIndexMeta{Name: name, Columns: []string{}, Unique: nonUnique.Valid && nonUnique.String == "0", Primary: name == "PRIMARY", IndexType: indexTypeStr}, columns: make([]indexColumn, 0)}
		}

		if columnName.Valid {
			seq := len(indexMap[name].columns) + 1
			if seqInIndex.Valid {
				if parsed, parseErr := strconv.Atoi(seqInIndex.String); parseErr == nil {
					seq = parsed
				}
			}
			indexMap[name].columns = append(indexMap[name].columns, indexColumn{name: columnName.String, seq: seq})
		}
	}

	indexes := make([]MysqlIndexMeta, 0, len(indexMap))
	for _, index := range indexMap {
		sort.SliceStable(index.columns, func(i, j int) bool {
			if index.columns[i].seq == index.columns[j].seq {
				return index.columns[i].name < index.columns[j].name
			}
			return index.columns[i].seq < index.columns[j].seq
		})
		index.meta.Columns = make([]string, 0, len(index.columns))
		for _, column := range index.columns {
			index.meta.Columns = append(index.meta.Columns, column.name)
		}
		indexes = append(indexes, index.meta)
	}

	sort.SliceStable(indexes, func(i, j int) bool {
		if indexes[i].Primary != indexes[j].Primary {
			return indexes[i].Primary
		}
		return indexes[i].Name < indexes[j].Name
	})

	return indexes, nil
}

func (m *Module) MysqlCreateIndex(req MysqlCreateIndexRequest) (string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[req.ConnectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return "", fmt.Errorf("connection not found: %s", req.ConnectionID)
	}
	if len(req.Columns) == 0 {
		return "", fmt.Errorf("at least one column is required for index")
	}

	columnList := ""
	for i, col := range req.Columns {
		if i > 0 {
			columnList += ", "
		}
		columnList += fmt.Sprintf("`%s`", col)
	}

	uniqueStr := ""
	if req.Unique {
		uniqueStr = "UNIQUE "
	}

	typeStr := ""
	if req.IndexType != "" && req.IndexType != "BTREE" {
		typeStr = fmt.Sprintf(" USING %s", req.IndexType)
	}

	var query string
	if req.Database != "" {
		query = fmt.Sprintf("CREATE %sINDEX `%s` ON `%s`.`%s` (%s)%s", uniqueStr, req.IndexName, req.Database, req.TableName, columnList, typeStr)
	} else {
		query = fmt.Sprintf("CREATE %sINDEX `%s` ON `%s` (%s)%s", uniqueStr, req.IndexName, req.TableName, columnList, typeStr)
	}

	if _, err := db.Exec(query); err != nil {
		return "", fmt.Errorf("failed to create index: %w", err)
	}

	return fmt.Sprintf("Index '%s' created successfully", req.IndexName), nil
}

func (m *Module) MysqlDropIndex(req MysqlDropIndexRequest) (string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[req.ConnectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return "", fmt.Errorf("connection not found: %s", req.ConnectionID)
	}
	if req.IndexName == "PRIMARY" {
		return "", fmt.Errorf("cannot drop PRIMARY key using DROP INDEX, use ALTER TABLE instead")
	}

	var query string
	if req.Database != "" {
		query = fmt.Sprintf("DROP INDEX `%s` ON `%s`.`%s`", req.IndexName, req.Database, req.TableName)
	} else {
		query = fmt.Sprintf("DROP INDEX `%s` ON `%s`", req.IndexName, req.TableName)
	}

	if _, err := db.Exec(query); err != nil {
		return "", fmt.Errorf("failed to drop index: %w", err)
	}

	return fmt.Sprintf("Index '%s' dropped successfully", req.IndexName), nil
}
