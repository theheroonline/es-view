package backend

import "context"

type MysqlExportRequest struct {
	ConnectionID string   `json:"connectionId"`
	Database     string   `json:"database"`
	Table        string   `json:"tableName,omitempty"`
	Tables       []string `json:"tableNames,omitempty"`
	IncludeData  bool     `json:"includeData"`
}

type MysqlImportSqlRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     string `json:"database"`
	Table        string `json:"tableName,omitempty"`
}

func (a *App) MysqlExportDatabase(req MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportDatabase(a.ctx, req)
}

func (a *App) MysqlExportTable(req MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportTable(a.ctx, req)
}

func (a *App) MysqlExportTables(req MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportTables(a.ctx, req)
}

func (a *App) MysqlImportSql(req MysqlImportSqlRequest) (string, error) {
	return a.mysql.MysqlImportSql(a.ctx, req)
}

func (m *MysqlModule) MysqlExportDatabase(ctx context.Context, req MysqlExportRequest) (string, error) {
	return m.transfer.ExportDatabase(ctx, req)
}

func (m *MysqlModule) MysqlExportTable(ctx context.Context, req MysqlExportRequest) (string, error) {
	return m.transfer.ExportTable(ctx, req)
}

func (m *MysqlModule) MysqlExportTables(ctx context.Context, req MysqlExportRequest) (string, error) {
	return m.transfer.ExportTables(ctx, req)
}

func (m *MysqlModule) MysqlImportSql(ctx context.Context, req MysqlImportSqlRequest) (string, error) {
	return m.transfer.ImportSQL(ctx, req)
}
