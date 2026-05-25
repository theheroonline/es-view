package mysql

import (
	"database/sql"
	"strings"
)

func scanRowsToNullStringMaps(rows *sql.Rows) ([]string, []map[string]sql.NullString, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, nil, err
	}

	result := make([]map[string]sql.NullString, 0)
	for rows.Next() {
		values := make([]sql.NullString, len(columns))
		destinations := make([]interface{}, len(columns))
		for i := range values {
			destinations[i] = &values[i]
		}

		if err := rows.Scan(destinations...); err != nil {
			return nil, nil, err
		}

		rowMap := make(map[string]sql.NullString, len(columns))
		for i, column := range columns {
			rowMap[strings.ToLower(column)] = values[i]
		}
		result = append(result, rowMap)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	return columns, result, nil
}

func getNullStringValueByIndex(columns []string, row map[string]sql.NullString, index int) sql.NullString {
	if index < 0 || index >= len(columns) {
		return sql.NullString{}
	}

	return row[strings.ToLower(columns[index])]
}

func getNullStringValue(row map[string]sql.NullString, column string) sql.NullString {
	return row[strings.ToLower(column)]
}
