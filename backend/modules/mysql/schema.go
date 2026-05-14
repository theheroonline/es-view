package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strconv"
)

func (m *Module) MysqlListDatabases(connectionID string) ([]string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()
	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
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

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()
	rows, err := queryWithRetry(db, query, ctx)
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

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()
	rows, err := db.QueryContext(ctx, query)
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

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()
	rows, err := db.QueryContext(ctx, query)
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

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()
	if _, err := db.ExecContext(ctx, query); err != nil {
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

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()
	if _, err := db.ExecContext(ctx, query); err != nil {
		return "", fmt.Errorf("failed to drop index: %w", err)
	}

	return fmt.Sprintf("Index '%s' dropped successfully", req.IndexName), nil
}
