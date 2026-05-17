import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useMysqlContext } from "../../../state/MysqlContext";
import { getMysqlOpenedTableKey } from "../types";
import { AddRowModal } from "../features/table-manager/components/AddRowModal";
import { BatchEditModal } from "../features/table-manager/components/BatchEditModal";
import { ColumnEditModal } from "../features/table-manager/components/ColumnEditModal";
import { ColumnHeaderContextMenu as ColumnHeaderContextMenuPanel } from "../features/table-manager/components/ColumnHeaderContextMenu";
import { ConfirmDialog } from "../features/table-manager/components/ConfirmDialog";
import { CopyTableDialog } from "../features/table-manager/components/CopyTableDialog";
import { CreateTableModal } from "../features/table-manager/components/CreateTableModal";
import { ExportSelectionModal } from "../features/table-manager/components/ExportSelectionModal";
import { IndexManagementModal } from "../features/table-manager/components/IndexManagementModal";
import { RowContextMenu as RowContextMenuPanel } from "../features/table-manager/components/RowContextMenu";
import { SortDataModal } from "../features/table-manager/components/SortDataModal";
import { SqlExecutionModal } from "../features/table-manager/components/SqlExecutionModal";
import { SuccessOverlay } from "../features/table-manager/components/SuccessOverlay";
import { TableManagerWorkspace } from "../features/table-manager/components/TableManagerWorkspace";
import { TreeContextMenu as TreeContextMenuPanel } from "../features/table-manager/components/TreeContextMenu";
import { useContextMenuStyle } from "../features/table-manager/hooks/useContextMenuStyle";
import { useCreateTable } from "../features/table-manager/hooks/useCreateTable";
import { useExportImport } from "../features/table-manager/hooks/useExportImport";
import { useTableColumnActions } from "../features/table-manager/hooks/useTableColumnActions";
import { useTableColumnHeaderMenuActions } from "../features/table-manager/hooks/useTableColumnHeaderMenuActions";
import { useTableContextMenuActions } from "../features/table-manager/hooks/useTableContextMenuActions";
import { useTableDataActions } from "../features/table-manager/hooks/useTableDataActions";
import { useTableIndexManagementActions } from "../features/table-manager/hooks/useTableIndexManagementActions";
import { useTableLifecycleActions } from "../features/table-manager/hooks/useTableLifecycleActions";
import { useTableLifecycleEffects } from "../features/table-manager/hooks/useTableLifecycleEffects";
import { useTableMenuDismiss } from "../features/table-manager/hooks/useTableMenuDismiss";
import { useTableOverviewActions } from "../features/table-manager/hooks/useTableOverviewActions";
import { useTableRowActions } from "../features/table-manager/hooks/useTableRowActions";
import { useTableSchemaActions } from "../features/table-manager/hooks/useTableSchemaActions";
import { useTableSelectionActions } from "../features/table-manager/hooks/useTableSelectionActions";
import { useTableSqlExecution } from "../features/table-manager/hooks/useTableSqlExecution";
import { useTableTreeMenuActions } from "../features/table-manager/hooks/useTableTreeMenuActions";
import { useTableManagerState } from "../features/table-manager/state/useTableManagerState";
import {
  buildFilterOperators,
  defaultDataState,
  escapeSqlIdentifier,
  mysqlColumnTypeOptions,
} from "../features/table-manager/utils";

export default function MysqlTableManager() {
  const MAX_SHIFT_SELECTION_CELLS = 5000;
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeMysqlConnection,
    setDatabases,
    tablesByDb,
    setTablesByDb,
    expandedDatabase,
    setExpandedDatabase,
    selectedDatabase,
    selectedTable,
    setSelectedDatabase,
    setSelectedTable,
    openedTables,
    setOpenedTables,
    activeOpenedTableKey,
    setActiveOpenedTableKey,
    saveTableDataCache,
    getTableDataCache,
  } = useMysqlContext();
  const {
    selectedTableInfo,
    setSelectedTableInfo,
    loading,
    setLoading,
    error,
    setError,
    rightPanelTab,
    setRightPanelTab,
    treeContextMenu,
    setTreeContextMenu,
    rowContextMenu,
    setRowContextMenu,
    columnHeaderContextMenu,
    setColumnHeaderContextMenu,
    selectedOverviewTables,
    setSelectedOverviewTables,
    overviewSelectionAnchor,
    setOverviewSelectionAnchor,
    selectedOverviewTablesRef,
    latestDataRequestRef,
    activeDataRequestKeyRef,
    currentLoadingTableKeyRef,
    dataState,
    setDataState,
    dataColumnMeta,
    setDataColumnMeta,
    selectedRowIndex,
    setSelectedRowIndex,
    selectedCells,
    setSelectedCells,
    selectionAnchor,
    setSelectionAnchor,
    batchEditModalOpen,
    setBatchEditModalOpen,
    batchEditMode,
    setBatchEditMode,
    batchEditValue,
    setBatchEditValue,
    batchEditError,
    setBatchEditError,
    addRowModalOpen,
    setAddRowModalOpen,
    addRowFormData,
    setAddRowFormData,
    addRowError,
    setAddRowError,
    filterPanelOpen,
    setFilterPanelOpen,
    sortModalOpen,
    setSortModalOpen,
    columnMenuOpen,
    setColumnMenuOpen,
    filterDraftTree,
    setFilterDraftTree,
    sortDraft,
    setSortDraft,
    sqlModalOpen,
    setSqlModalOpen,
    sqlModalValue,
    setSqlModalValue,
    sqlModalResult,
    setSqlModalResult,
    sqlModalLoading,
    setSqlModalLoading,
    columnEditOpen,
    setColumnEditOpen,
    columnEditMode,
    setColumnEditMode,
    columnEditOriginalField,
    setColumnEditOriginalField,
    columnEditForm,
    setColumnEditForm,
    columnEditLoading,
    setColumnEditLoading,
    columnEditError,
    setColumnEditError,
    confirmDialog,
    setConfirmDialog,
    indexModalOpen,
    setIndexModalOpen,
    indexModalMode,
    setIndexModalMode,
    indexes,
    setIndexes,
    indexLoading,
    setIndexLoading,
    indexError,
    setIndexError,
    indexFormData,
    setIndexFormData,
    selectedCellKeySet,
    selectedRowCount,
  } = useTableManagerState();

  const connectionId = activeMysqlConnection?.id;
  const isTableWorkspace = location.pathname === "/mysql/table";

  // Export/import functionality
  const {
    exportSelectionModal,
    setExportSelectionModal,
    exportSuccessMessage,
    setExportSuccessMessage,
    handleExportTableSql,
    handleImportTableSql: exportImportHandleImportTableSql,
    handleConfirmExportSelection
  } = useExportImport({
    connectionId,
    onError: (err) => setError(err instanceof Error ? err.message : String(err))
  });

  // Create table functionality
  const {
    createTableModal,
    setCreateTableModal,
    createTableError,
    createTableLoading,
    createTableSuccess,
    setCreateTableSuccess,
    selectedEditingRowId,
    setSelectedEditingRowId,
    editingRows,
    setEditingRows,
    handleAddColumn,
    handleDeleteColumn,
    openCreateTable,
    handleCreateTable
  } = useCreateTable({
    connectionId,
    tablesByDb,
    setTablesByDb,
    onError: (err) => setError(err instanceof Error ? err.message : String(err))
  });

  const activeOpenedTable = useMemo(() => {
    return activeOpenedTableKey
      ? openedTables.find((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey) ?? null
      : null;
  }, [activeOpenedTableKey, openedTables]);

  const filterOperators = buildFilterOperators(t);

  const activeFilterTree = activeOpenedTable?.filterTree ?? null;
  const overviewTables = tablesByDb[expandedDatabase ?? ""] ?? [];

  const {
    openIndexModal,
    openCreateIndexModal,
    openEditIndexModal,
    handleCreateIndex,
    handleUpdateIndex,
    handleDropIndex,
    handleBackToIndexView,
    handleIndexNameChange,
    handleIndexToggleColumn,
    handleIndexUniqueChange,
    handleIndexTypeChange,
  } = useTableIndexManagementActions({
    connectionId,
    selectedTableInfo,
    indexes,
    indexFormData,
    setIndexes,
    setIndexLoading,
    setIndexError,
    setIndexModalOpen,
    setIndexModalMode,
    setIndexFormData,
    setConfirmDialog,
    t,
  });

  const {
    handleSelectTable,
    getOrderedSelectedTables,
    handleOverviewTableClick,
    clearOverviewTableSelection,
    handleOverviewTableDragStart,
    handleBrowseData,
    handleDesignTable,
  } = useTableOverviewActions({
    tablesByDb,
    selectedOverviewTables,
    overviewSelectionAnchor,
    setSelectedDatabase,
    setSelectedTable,
    setSelectedOverviewTables,
    setOverviewSelectionAnchor,
    setOpenedTables,
    setActiveOpenedTableKey,
    navigate,
  });


  const {
    syncFilterDraftFromOpenedTable,
    fetchData,
    totalPages,
    handlePageChange,
    handlePageSizeChange,
    copyToClipboard,
    visibleDataColumns,
    handleVisibleColumnToggle,
    handleSelectAllVisibleColumns,
    applyFilter,
    clearFilter,
    applySort,
    clearSort,
    handleToggleFilterPanel,
    handleOpenSortModal,
  } = useTableDataActions({
    connectionId,
    activeOpenedTable,
    selectedTableInfo,
    dataState,
    latestDataRequestRef,
    activeDataRequestKeyRef,
    setDataState,
    setOpenedTables,
    setFilterDraftTree,
    setFilterPanelOpen,
    setSortModalOpen,
    setSortDraft,
    filterDraftTree,
    setError,
    saveTableDataCache,
    dataColumnMeta,
  });

  const {
    handleCellClick,
    handleRowContextMenu,
  } = useTableSelectionActions({
    maxShiftSelectionCells: MAX_SHIFT_SELECTION_CELLS,
    columns: dataState.columns,
    selectedCells,
    selectionAnchor,
    selectedCellKeySet,
    t,
    setSelectedCells,
    setSelectionAnchor,
    setSelectedRowIndex,
    setError,
    setRowContextMenu,
  });

  const {
    refreshDatabases,
    refreshTablesForDb,
    handleOpenTable,
  } = useTableLifecycleActions({
    connectionId,
    expandedDatabase,
    openedTables,
    activeOpenedTableKey,
    locationPathname: location.pathname,
    selectedTableInfo,
    selectedDatabase,
    selectedTable,
    navigate,
    setLoading,
    setDatabases,
    setTablesByDb,
    setExpandedDatabase,
    setSelectedDatabase,
    setSelectedTable,
    setOpenedTables,
    setActiveOpenedTableKey,
    setSelectedTableInfo,
    setDataState,
    setDataColumnMeta,
    setSelectedOverviewTables,
    setOverviewSelectionAnchor,
    setRightPanelTab,
    setError,
    fetchData,
    latestDataRequestRef,
    activeDataRequestKeyRef,
    saveTableDataCache,
    currentLoadingTableKeyRef,
  });

  useTableLifecycleEffects({
    selectedOverviewTablesRef,
    selectedOverviewTables,
    isTableWorkspace,
    activeOpenedTable,
    handleOpenTable,
    syncFilterDraftFromOpenedTable,
    dataColumns: dataState.columns,
    connectionId,
    latestDataRequestRef,
    activeDataRequestKeyRef,
    setSelectedTableInfo,
    setDataState,
    setDataColumnMeta,
    clearOverviewTableSelection,
    expandedDatabase,
    tablesByDb,
    refreshTablesForDb,
    selectedTableInfo,
    locationPathname: location.pathname,
    setSelectedTable,
    setRightPanelTab,
    defaultDataState,
    getTableDataCache,
    setOpenedTables,
  });


  const {
    updateRowByIndex,
    handleSaveCell,
    handleDeleteRow,
    handleContextMenuBatchEdit,
    handleBatchEditSave,
    handleAddNewRow,
    handleSaveNewRowWithForm,
    handleCancelNewRow,
  } = useTableRowActions({
    connectionId,
    selectedTableInfo,
    dataState,
    dataColumnMeta,
    selectedCells,
    batchEditMode,
    batchEditValue,
    activeOpenedTable,
    t,
    fetchData,
    setConfirmDialog,
    setDataState,
    setBatchEditModalOpen,
    setBatchEditMode,
    setBatchEditValue,
    setBatchEditError,
    setSelectedCells,
    setSelectionAnchor,
    setAddRowModalOpen,
    setAddRowFormData,
    setAddRowError,
    saveTableDataCache,
  });

  const {
    copyTableDialog,
    setCopyTableDialog,
    handleDropTable,
    handleTruncateTable,
    handleCopyTable,
    handleConfirmCopyTable,
  } = useTableSchemaActions({
    connectionId,
    selectedTableInfo,
    rightPanelTab,
    activeOpenedTableKey,
    openedTables,
    locationPathname: location.pathname,
    navigate,
    refreshTablesForDb,
    handleOpenTable,
    setTablesByDb,
    setSelectedTable,
    setSelectedTableInfo,
    setDataState,
    setOpenedTables,
    setActiveOpenedTableKey,
    setConfirmDialog,
    setError,
    t,
  });

  const {
    handleContextMenuCopyRow,
    handleContextMenuCopyInsert,
    handleContextMenuCopyUpdate,
    handleContextMenuFilterByValue,
    handleContextMenuSortAsc,
    handleContextMenuSortDesc,
    handleContextMenuDelete,
    handleContextMenuSetNull,
    handleContextMenuSetEmptyString,
    handleContextMenuBatchEditWithClose,
  } = useTableContextMenuActions({
    selectedCells,
    dataState,
    selectedTableInfo,
    rowContextMenu,
    activeFilterTree,
    t,
    escapeSqlIdentifier,
    copyToClipboard,
    applyFilter,
    applySort,
    handleDeleteRow,
    updateRowByIndex,
    handleContextMenuBatchEdit,
    setRowContextMenu,
  });

  const {
    handleTableContextMenu,
    handleExportTableSqlWrapper,
    handleImportTableSql,
    openExportSelectionModal,
    handleToggleExportSelectionTable,
    handleTreeOpenTableWithClose,
    handleTreeDesignTableWithClose,
    handleTreeCopyTableWithClose,
    handleTreeTruncateTableWithClose,
    handleTreeDropTableWithClose,
  } = useTableTreeMenuActions({
    selectedOverviewTablesRef,
    selectedTableInfo,
    rightPanelTab,
    tablesByDb,
    t,
    handleSelectTable,
    getOrderedSelectedTables,
    refreshTablesForDb,
    handleOpenTable,
    handleBrowseData,
    handleDesignTable,
    handleCopyTable,
    handleTruncateTable,
    handleDropTable,
    handleExportTableSql,
    exportImportHandleImportTableSql,
    setSelectedOverviewTables,
    setOverviewSelectionAnchor,
    setTreeContextMenu,
    setExportSelectionModal,
  });

  const {
    handleColumnHeaderSortAsc,
    handleColumnHeaderSortDesc,
    handleColumnHeaderClearSort,
  } = useTableColumnHeaderMenuActions({
    columnHeaderContextMenu,
    applySort,
    clearSort,
    setColumnHeaderContextMenu,
  });

  // ─── Context menu ───

  const { getContextMenuStyle } = useContextMenuStyle();


  // 仅在表切换时清除选中状态，避免分页/其他状态变化触发闪烁
  // Also reset transient UI state (modals, drafts, selection) when switching tables
  // to prevent state from one table leaking into another.
  useEffect(() => {
    setSelectedCells([]);
    setSelectionAnchor(null);
    setSelectedRowIndex(null);
    setFilterPanelOpen(false);
    setSortModalOpen(false);
    setColumnMenuOpen(false);
    setSqlModalOpen(false);
    setColumnEditOpen(false);
    setBatchEditModalOpen(false);
    setAddRowModalOpen(false);
    setFilterDraftTree(null);
    setSortDraft({ column: "", direction: "asc" });
    setBatchEditValue("");
    setBatchEditError("");
    setSqlModalValue("");
    setSqlModalResult("");
    setSqlModalLoading(false);
    setAddRowFormData({});
    setAddRowError("");
    setColumnHeaderContextMenu(null);
    setError("");
  }, [activeOpenedTableKey]);

  useTableMenuDismiss({
    rowMenuOpen: Boolean(rowContextMenu),
    treeMenuOpen: Boolean(treeContextMenu),
    columnHeaderMenuOpen: Boolean(columnHeaderContextMenu),
    columnMenuOpen,
    closeRowMenu: () => setRowContextMenu(null),
    closeTreeMenu: () => setTreeContextMenu(null),
    closeColumnHeaderMenu: () => setColumnHeaderContextMenu(null),
    closeColumnMenu: () => setColumnMenuOpen(false),
  });

  // ─── SQL modal ───
  const { executeSqlModal } = useTableSqlExecution({
    connectionId,
    sqlModalValue,
    selectedDatabase,
    refreshDatabases,
    refreshTablesForDb,
    setSqlModalLoading,
    setSqlModalResult,
  });

  const {
    openAddColumnModal,
    openEditColumnModal,
    handleSaveColumnEdit,
    handleMoveColumn,
    handleDropColumn,
  } = useTableColumnActions({
    connectionId,
    selectedTableInfo,
    rightPanelTab,
    columnEditMode,
    columnEditForm,
    handleOpenTable,
    setColumnEditMode,
    setColumnEditOriginalField,
    setColumnEditForm,
    setColumnEditError,
    setColumnEditOpen,
    setColumnEditLoading,
    setConfirmDialog,
    setError,
    t,
  });

  const toolbarActions = useMemo(() => {
    if (rightPanelTab !== "data") return null;

    return (
      <div className="tm-toolbar-actions">
        <button className="btn btn-sm btn-ghost" onClick={handleAddNewRow}>
          {t("mysql.tableManager.addNewRow")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={handleToggleFilterPanel}>
          {t("mysql.tableManager.filterData")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={handleOpenSortModal}>
          {t("mysql.tableManager.sortData")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setColumnMenuOpen((prev) => !prev)}>
          {t("mysql.tableManager.displayColumns")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => { void fetchData(); }} disabled={dataState.loading}>
          {dataState.loading ? t("common.loading") : t("common.refresh")}
        </button>
        {columnMenuOpen && dataState.columns.length > 0 && (
          <div className="tm-column-menu-dropdown">
            <div className="tm-column-menu-body">
              <div className="tm-column-menu-tools">
                <button className="btn btn-sm btn-ghost" onClick={handleSelectAllVisibleColumns}>
                  {t("common.selectAll")}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setColumnMenuOpen(false)}>
                  {t("common.close")}
                </button>
              </div>
              {dataState.columns.map((column) => {
                const checked = visibleDataColumns.includes(column);
                return (
                  <label key={column} className={`tm-column-option ${checked ? "is-checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => handleVisibleColumnToggle(column, event.target.checked)}
                    />
                    {column}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }, [rightPanelTab, columnMenuOpen, dataState.loading, dataState.columns, visibleDataColumns, t, handleAddNewRow, handleToggleFilterPanel, handleOpenSortModal, fetchData, handleSelectAllVisibleColumns, handleVisibleColumnToggle, setColumnMenuOpen]);

  // ─── Render ───
  if (!activeMysqlConnection) {
    return (
      <div className="page">
        <div className="card workspace-empty-card">
          <span className="muted">{t("mysql.query.noMysqlConnection")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <TableManagerWorkspace
        isTableWorkspace={isTableWorkspace}
        activeOpenedTable={activeOpenedTable}
        rightPanelTab={rightPanelTab}
        toolbarActions={toolbarActions}
        overviewPaneProps={{
          connectionId,
          expandedDatabase: expandedDatabase ?? null,
          tables: overviewTables,
          selectedTable,
          selectedOverviewTables,
          loading,
          onTableClick: handleOverviewTableClick,
          onBrowseTable: handleBrowseData,
          onTableDragStart: handleOverviewTableDragStart,
          onTableContextMenu: handleTableContextMenu,
          onRefreshTables: refreshTablesForDb,
          onOpenCreateTable: () => openCreateTable(expandedDatabase ?? ""),
        }}
        dataPaneProps={{
          connectionId,
          selectedTableInfo,
          dataState,
          visibleDataColumns,
          selectedCellKeySet,
          selectedRowIndex,
          filterPanelOpen,
          filterDraftTree,
          totalPages,
          filterOperators,
          onSetFilterPanelOpen: setFilterPanelOpen,
          onSetFilterDraftTree: setFilterDraftTree,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
          onCellClick: handleCellClick,
          onRowContextMenu: handleRowContextMenu,
          onSaveCell: handleSaveCell,
          onClearFilter: clearFilter,
          onApplyFilter: applyFilter,
        }}
        structurePaneProps={{
          selectedTableInfo,
          onAddColumn: openAddColumnModal,
          onManageIndexes: openIndexModal,
          onMoveColumn: handleMoveColumn,
          onEditColumn: openEditColumnModal,
          onDropColumn: handleDropColumn,
        }}
        infoPaneProps={{
          selectedTableInfo,
        }}
      />

      {/* Error */}
      {error && (
        <div className="text-danger tm-error-banner">
          {error}
          <button className="btn btn-sm btn-ghost" onClick={() => setError("")}>{t("common.close")}</button>
        </div>
      )}

      <TreeContextMenuPanel
        menu={treeContextMenu}
        style={treeContextMenu
          ? getContextMenuStyle(treeContextMenu.x, treeContextMenu.y, 180, treeContextMenu.selectedTables.length <= 1 ? 420 : 140)
          : {}}
        onOpenTable={(db, table) => {
          void handleTreeOpenTableWithClose(db, table);
        }}
        onDesignTable={(db, table) => {
          void handleTreeDesignTableWithClose(db, table);
        }}
        onImportSql={(db, table) => {
          void handleImportTableSql(db, table);
        }}
        onExportStructure={(db, table) => {
          void handleExportTableSqlWrapper(db, table, false);
        }}
        onExportStructureAndData={(db, table) => {
          void handleExportTableSqlWrapper(db, table, true);
        }}
        onExportSelected={(db, tables) => {
          openExportSelectionModal(db, tables, false);
        }}
        onCopyTable={(db, table) => {
          void handleTreeCopyTableWithClose(db, table);
        }}
        onTruncateTable={(db, table) => {
          void handleTreeTruncateTableWithClose(db, table);
        }}
        onDropTable={(db, table) => {
          void handleTreeDropTableWithClose(db, table);
        }}
      />

      <ExportSelectionModal
        state={exportSelectionModal}
        onClose={() => setExportSelectionModal(null)}
        onSelectAll={() => setExportSelectionModal((previous) => previous ? {
          ...previous,
          selectedTables: previous.availableTables,
        } : previous)}
        onClearSelection={() => setExportSelectionModal((previous) => previous ? {
          ...previous,
          selectedTables: [],
        } : previous)}
        onIncludeDataChange={(includeData) => setExportSelectionModal((previous) => previous ? {
          ...previous,
          includeData,
        } : previous)}
        onToggleTable={handleToggleExportSelectionTable}
        onConfirm={() => void handleConfirmExportSelection()}
      />

      <RowContextMenuPanel
        menu={rowContextMenu}
        style={rowContextMenu ? getContextMenuStyle(rowContextMenu.x, rowContextMenu.y, 200, 420) : {}}
        selectedCellsCount={selectedCells.length}
        selectedRowsCount={selectedRowCount}
        onCopyRows={handleContextMenuCopyRow}
        onCopyInsert={handleContextMenuCopyInsert}
        onCopyUpdate={handleContextMenuCopyUpdate}
        onFilterByValue={handleContextMenuFilterByValue}
        onSortAsc={handleContextMenuSortAsc}
        onSortDesc={handleContextMenuSortDesc}
        onSetNull={handleContextMenuSetNull}
        onSetEmptyString={handleContextMenuSetEmptyString}
        onBatchEdit={handleContextMenuBatchEditWithClose}
        onDelete={handleContextMenuDelete}
      />

      <ColumnHeaderContextMenuPanel
        menu={columnHeaderContextMenu}
        style={columnHeaderContextMenu ? getContextMenuStyle(columnHeaderContextMenu.x, columnHeaderContextMenu.y, 200, 180) : {}}
        onSortAsc={handleColumnHeaderSortAsc}
        onSortDesc={handleColumnHeaderSortDesc}
        onClearSort={handleColumnHeaderClearSort}
      />

      {/* 批量编辑 Modal */}
      {batchEditModalOpen && (
        <BatchEditModal
          isOpen={batchEditModalOpen}
          selectedCellsCount={selectedCells.length}
          batchEditMode={batchEditMode}
          batchEditValue={batchEditValue}
          batchEditError={batchEditError}
          onModeChange={setBatchEditMode}
          onValueChange={setBatchEditValue}
          onClose={() => setBatchEditModalOpen(false)}
          onSave={() => void handleBatchEditSave()}
        />
      )}

      <SortDataModal
        isOpen={sortModalOpen}
        columns={dataState.columns}
        draft={sortDraft}
        onDraftChange={(updater) => setSortDraft((previous) => updater(previous))}
        onClose={() => setSortModalOpen(false)}
        onClear={() => void clearSort()}
        onApply={(column, direction) => void applySort(column, direction)}
      />

      <ColumnEditModal
        isOpen={columnEditOpen}
        mode={columnEditMode}
        originalField={columnEditOriginalField}
        form={columnEditForm}
        loading={columnEditLoading}
        error={columnEditError}
        onClose={() => setColumnEditOpen(false)}
        onSave={handleSaveColumnEdit}
        onFormChange={(updater) => setColumnEditForm((prev) => updater(prev))}
      />

      <IndexManagementModal
        isOpen={indexModalOpen}
        mode={indexModalMode}
        indexes={indexes}
        loading={indexLoading}
        error={indexError}
        formData={indexFormData}
        tableColumns={selectedTableInfo?.columns}
        onClose={() => setIndexModalOpen(false)}
        onBackToView={handleBackToIndexView}
        onOpenCreate={openCreateIndexModal}
        onOpenEdit={openEditIndexModal}
        onDrop={(indexName) => void handleDropIndex(indexName)}
        onCreate={() => void handleCreateIndex()}
        onUpdate={() => void handleUpdateIndex()}
        onNameChange={handleIndexNameChange}
        onToggleColumn={handleIndexToggleColumn}
        onUniqueChange={handleIndexUniqueChange}
        onIndexTypeChange={handleIndexTypeChange}
      />

      <SqlExecutionModal
        isOpen={sqlModalOpen}
        value={sqlModalValue}
        result={sqlModalResult}
        loading={sqlModalLoading}
        onValueChange={setSqlModalValue}
        onClose={() => setSqlModalOpen(false)}
        onExecute={executeSqlModal}
      />

      {/* Create Table Modal */}
      <CreateTableModal
        isOpen={createTableModal !== null}
        modalState={createTableModal}
        editingRows={editingRows}
        selectedEditingRowId={selectedEditingRowId}
        isLoading={createTableLoading}
        error={createTableError}
        onTableNameChange={(name) => setCreateTableModal((prev) => prev ? { ...prev, tableName: name } : null)}
        onEngineChange={(engine) => setCreateTableModal((prev) => prev ? { ...prev, engine } : null)}
        onCharsetChange={(charset) => setCreateTableModal((prev) => prev ? { ...prev, charset } : null)}
        onColumnNullableChange={(columnId, nullable) => setCreateTableModal((prev) => prev ? { ...prev, columns: prev.columns.map(col => col.id === columnId ? { ...col, nullable } : col) } : null)}
        onColumnPrimaryChange={(columnId, isPrimary) => setCreateTableModal((prev) => prev ? { ...prev, columns: prev.columns.map(col => col.id === columnId ? { ...col, isPrimary } : col) } : null)}
        onColumnAutoIncrementChange={(columnId, autoIncrement) => setCreateTableModal((prev) => prev ? { ...prev, columns: prev.columns.map(col => col.id === columnId ? { ...col, autoIncrement } : col) } : null)}
        onDeleteColumn={(columnId) => handleDeleteColumn(columnId)}
        onSelectEditingRow={(rowId) => setSelectedEditingRowId(rowId)}
        onEditingRowNameChange={(rowId, name) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, name } : r))}
        onEditingRowTypeChange={(rowId, type) => {
          const typeOption = mysqlColumnTypeOptions.find(opt => opt.value === type);
          setEditingRows((prev) => prev.map(r => r.id === rowId ? {
            ...r,
            type,
            length: typeOption?.lengthMode === "none" ? "" : r.length,
            scale: typeOption?.lengthMode === "pair" ? r.scale : ""
          } : r));
        }}
        onEditingRowLengthChange={(rowId, length) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, length } : r))}
        onEditingRowScaleChange={(rowId, scale) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, scale } : r))}
        onEditingRowNullableChange={(rowId, nullable) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, nullable } : r))}
        onEditingRowPrimaryChange={(rowId, isPrimary) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, isPrimary } : r))}
        onEditingRowAutoIncrementChange={(rowId, autoIncrement) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, autoIncrement } : r))}
        onEditingRowDefaultValueChange={(rowId, defaultValue) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, defaultValue } : r))}
        onEditingRowCommentChange={(rowId, comment) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, comment } : r))}
        onEditingRowExtraAttributesChange={(rowId, extraAttributes) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, extraAttributes } as any : r))}
        onMoveEditingRowUp={(rowId) => {
          const index = editingRows.findIndex(r => r.id === rowId);
          if (index > 0) {
            const newRows = [...editingRows];
            [newRows[index], newRows[index - 1]] = [newRows[index - 1], newRows[index]];
            setEditingRows(newRows);
          }
        }}
        onMoveEditingRowDown={(rowId) => {
          const index = editingRows.findIndex(r => r.id === rowId);
          if (index < editingRows.length - 1) {
            const newRows = [...editingRows];
            [newRows[index], newRows[index + 1]] = [newRows[index + 1], newRows[index]];
            setEditingRows(newRows);
          }
        }}
        onDeleteEditingRow={(rowId) => setEditingRows((prev) => prev.filter(r => r.id !== rowId))}
        onClose={() => setCreateTableModal(null)}
        onSave={() => void handleCreateTable()}
        onAddColumn={handleAddColumn}
      />

      <AddRowModal
        isOpen={addRowModalOpen}
        columns={selectedTableInfo?.columns}
        formData={addRowFormData}
        error={addRowError}
        onClose={handleCancelNewRow}
        onSave={() => void handleSaveNewRowWithForm(addRowFormData)}
        onFieldChange={(field, value) => {
          setAddRowFormData((prev) => ({
            ...prev,
            [field]: value
          }));
        }}
      />

      <SuccessOverlay
        open={Boolean(exportSuccessMessage)}
        icon="💾"
        title={t("mysql.tableManager.exportSuccess")}
        message={exportSuccessMessage ? t("mysql.tableManager.exportedSuccessfully", { path: exportSuccessMessage }) : ""}
        onClose={() => setExportSuccessMessage(null)}
        okText={t("common.ok")}
      />

      <SuccessOverlay
        open={Boolean(createTableSuccess)}
        icon="✨"
        title={t("mysql.tableManager.createTableSuccess")}
        message={createTableSuccess ? t("mysql.tableManager.tableCreatedWithName", { name: createTableSuccess }) : ""}
        onClose={() => setCreateTableSuccess(null)}
        okText={t("common.ok")}
      />

      <CopyTableDialog
        dialog={copyTableDialog}
        onClose={() => setCopyTableDialog((previous) => ({ ...previous, open: false }))}
        onNextNameChange={(nextName) => setCopyTableDialog((previous) => ({ ...previous, nextName }))}
        onConfirm={() => void handleConfirmCopyTable()}
      />

      <ConfirmDialog
        dialog={confirmDialog}
        onClose={() => setConfirmDialog((previous) => ({ ...previous, open: false }))}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((previous) => ({ ...previous, open: false }));
        }}
      />
    </div>
  );
}
