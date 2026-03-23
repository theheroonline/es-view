import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import FieldFilterButton from "../../../../../components/FieldFilterButton";
import { logError } from "../../../../../lib/errorLog";
import { useElasticsearchContext } from "../../../../../state/ElasticsearchContext";
import { useEsContextMenu } from "../hooks/useEsContextMenu";
import { useEsDataBrowserAutoQuery } from "../hooks/useEsDataBrowserAutoQuery";
import { useEsDataBrowserCache } from "../hooks/useEsDataBrowserCache";
import { useEsDataBrowserPaginationInputs } from "../hooks/useEsDataBrowserPaginationInputs";
import { useEsDataBrowserState } from "../hooks/useEsDataBrowserState";
import { useEsDocumentActions } from "../hooks/useEsDocumentActions";
import { createDefaultEsCondition, useEsQueryConditions } from "../hooks/useEsQueryConditions";
import { useEsSearchExecution } from "../hooks/useEsSearchExecution";
import { loadIndexFields } from "../services/esSearchService";
import { EsDataBrowserContextMenu } from "./EsDataBrowserContextMenu";
import { EsDataBrowserDialogs } from "./EsDataBrowserDialogs";
import { EsDataBrowserResults } from "./EsDataBrowserResults";
import { EsDataBrowserToolbar } from "./EsDataBrowserToolbar";
import { EsQueryConditionsPanel } from "./EsQueryConditionsPanel";

export function EsDataBrowserFeature() {
  const { t, i18n } = useTranslation();
  const { activeConnection, indices } = useElasticsearchContext();
  const {
    selectedIndex,
    setSelectedIndex,
    showQueryConditions,
    setShowQueryConditions,
    fields,
    setFields,
    conditions,
    setConditions,
    page,
    setPage,
    size,
    setSize,
    sizeInput,
    setSizeInput,
    pageInput,
    setPageInput,
    result,
    setResult,
    error,
    setError,
    loading,
    setLoading,
    loadingMessage,
    setLoadingMessage,
    viewMode,
    setViewMode,
    editingDoc,
    setEditingDoc,
    editJson,
    setEditJson,
    showEditModal,
    setShowEditModal,
    deleteConfirmDialog,
    setDeleteConfirmDialog,
    contextMenu,
    setContextMenu,
    expandedRows,
    setExpandedRows,
    fieldFilter,
    setFieldFilter,
    selectedDocs,
    setSelectedDocs,
    contextMenuRef,
    skipNextAutoQueryRef,
  } = useEsDataBrowserState();

  const presets = [
    { label: t("presets.lastHour"), value: [dayjs().subtract(1, "hour"), dayjs()] as [Dayjs, Dayjs] },
    { label: t("presets.last24Hours"), value: [dayjs().subtract(24, "hour"), dayjs()] as [Dayjs, Dayjs] },
    { label: t("presets.last7Days"), value: [dayjs().subtract(7, "day"), dayjs()] as [Dayjs, Dayjs] },
    { label: t("presets.today"), value: [dayjs().startOf("day"), dayjs().endOf("day")] as [Dayjs, Dayjs] },
    { label: t("presets.yesterday"), value: [dayjs().subtract(1, "day").startOf("day"), dayjs().subtract(1, "day").endOf("day")] as [Dayjs, Dayjs] },
  ];

  useEffect(() => {
    dayjs.locale(i18n.language === "zh" ? "zh-cn" : "en");
  }, [i18n.language]);

  useEffect(() => {
    if (!activeConnection || !selectedIndex) {
      setFields([]);
      return;
    }
    let ignore = false;
    loadIndexFields(activeConnection, selectedIndex)
      .then((loadedFields) => {
        if (ignore) return;
        setFields(loadedFields);
      })
      .catch(() => {
        if (ignore) return;
        setFields([]);
      });
    return () => {
      ignore = true;
    };
  }, [activeConnection?.id, selectedIndex]);

  const {
    addCondition,
    addConditionFromContext,
    addSortFromContext,
    handleConditionChange,
    handleIndexChange,
    removeCondition,
    showConditions,
    toggleCondition,
  } = useEsQueryConditions({
    setConditions,
    setResult,
    setSelectedIndex,
    setShowQueryConditions,
  });

  useEsDataBrowserCache({
    activeConnectionId: activeConnection?.id,
    conditions,
    defaultCondition: createDefaultEsCondition(),
    fieldFilter,
    page,
    result,
    selectedIndex,
    setConditions,
    setFieldFilter,
    setFields,
    setPage,
    setResult,
    setSelectedIndex,
    setSize,
    setViewMode,
    size,
    skipNextAutoQueryRef,
    viewMode,
  });

  useEffect(() => {
    if (selectedIndex && !indices.includes(selectedIndex)) {
      setSelectedIndex(undefined);
      setResult(null);
    }
  }, [indices, selectedIndex]);

  const { commitPage, commitSize } = useEsDataBrowserPaginationInputs({
    page,
    pageInput,
    setPage,
    setPageInput,
    setSize,
    setSizeInput,
    size,
    sizeInput,
  });

  const formatDateTime = (value: Dayjs | null) => (value ? value.format("YYYY-MM-DD HH:mm:ss") : "");

  const { execute, executeQuery } = useEsSearchExecution({
    activeConnection,
    conditions,
    formatDateTime,
    page,
    selectedIndex,
    setError,
    setLoading,
    setLoadingMessage,
    setResult,
    size,
    t,
  });

  const handleAutoQueryError = useCallback((error: unknown) => {
    logError(error, {
      source: "esDataBrowser.autoQuery",
      message: "Automatic Elasticsearch query failed",
    });
  }, []);

  useEsDataBrowserAutoQuery({
    activeConnectionId: activeConnection?.id,
    executeQuery,
    onError: handleAutoQueryError,
    page,
    selectedIndex,
    setError,
    setLoading,
    setLoadingMessage,
    setResult,
    size,
    skipNextAutoQueryRef,
  });

  const totalInfo = result?.hits?.total;
  const total = totalInfo?.value ?? totalInfo ?? 0;
  const totalRelation = totalInfo?.relation;
  const rows = result?.hits?.hits ?? [];
  const selectedRows = rows.filter((row: any) => selectedDocs.has(row._id));

  const { confirmDeleteDoc, deleteSelectedDocs, openEdit, requestDeleteDoc, submitEdit } = useEsDocumentActions({
    activeConnection,
    editJson,
    editingDoc,
    execute,
    executeQuery,
    selectedIndex,
    selectedRows,
    setDeleteConfirmDialog,
    setEditJson,
    setEditingDoc,
    setError,
    setLoading,
    setResult,
    setSelectedDocs,
    setShowEditModal,
    t,
  });

  const {
    copyRow,
    copyValue,
    handleAddCondition,
    handleAddSort,
    handleContextMenu,
    handleDeleteRow,
    handleEditRow,
    toggleRowExpand,
  } = useEsContextMenu({
    contextMenu,
    contextMenuRef,
    onAddConditionFromContext: (boolType) => addConditionFromContext(contextMenu, boolType),
    onAddSortFromContext: (direction) => addSortFromContext(contextMenu, direction),
    onDeleteDoc: requestDeleteDoc,
    onEditDoc: openEdit,
    setContextMenu,
    setExpandedRows,
  });

  useEffect(() => {
    if (selectedDocs.size === 0) return;
    const validIds = new Set(rows.map((row: any) => row._id));
    const next = new Set(Array.from(selectedDocs).filter((id) => validIds.has(id)));
    if (next.size !== selectedDocs.size) {
      setSelectedDocs(next);
    }
  }, [rows, selectedDocs]);

  const allAvailableColumns = useMemo(() => {
    if (rows.length === 0) return [];
    const colSet = new Set<string>();
    rows.forEach((row: any) => {
      Object.keys(row._source || {}).forEach((key) => colSet.add(key));
    });
    return Array.from(colSet);
  }, [rows]);

  const filterCandidateFields = useMemo(() => {
    return fields.length > 0 ? fields : allAvailableColumns;
  }, [fields, allAvailableColumns]);

  const allColumns = useMemo(() => {
    if (!fieldFilter.enabled) return filterCandidateFields;
    return fieldFilter.fields.filter((fieldName: string) => filterCandidateFields.includes(fieldName));
  }, [fieldFilter.enabled, fieldFilter.fields, filterCandidateFields]);

  const toggleSelectAllRows = (checked: boolean) => {
    if (checked) {
      setSelectedDocs(new Set(rows.map((row: any) => row._id)));
      return;
    }
    setSelectedDocs(new Set());
  };

  const toggleSelectRow = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copySelectedDocs = () => {
    if (selectedRows.length === 0) return;
    const payload = selectedRows.map((row: any) => ({
      _id: row._id,
      _index: row._index,
      ...row._source,
    }));
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  const renderCellValue = (value: unknown, truncate = true) => {
    if (value === null || value === undefined) return <span className="muted">-</span>;

    const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
    const shouldTruncate = truncate && stringValue.length > 80;
    const preview = shouldTruncate ? `${stringValue.substring(0, 80)}...` : stringValue;

    return (
      <span className="truncated-cell" title={stringValue} data-truncated={shouldTruncate ? "true" : "false"}>
        <span className="truncated-text">{preview}</span>
      </span>
    );
  };

  return (
    <ConfigProvider locale={i18n.language === "zh" ? zhCN : enUS}>
      <div className="page" style={{ flex: 1, minHeight: 0, height: "100%" }}>
        <EsDataBrowserToolbar
          indices={indices}
          loading={loading}
          selectedIndex={selectedIndex}
          t={t}
          onExecute={execute}
          onSelectIndex={handleIndexChange}
          onShowFilters={showConditions}
        />

        <EsQueryConditionsPanel
          conditions={conditions}
          fields={fields}
          i18nLanguage={i18n.language}
          presets={presets}
          showQueryConditions={showQueryConditions}
          t={t}
          onAddCondition={addCondition}
          onChangeCondition={handleConditionChange}
          onClose={() => setShowQueryConditions(false)}
          onRemoveCondition={removeCondition}
          onToggleCondition={toggleCondition}
        />

        <div className="toolbar" style={{ margin: "0 0 16px 0", border: "none", background: "transparent", padding: 0, position: "relative" }}>
          <div className="flex-gap items-center">
            <div className="flex-gap items-center" style={{ background: "white", padding: "6px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (page > 1) {
                    setPage((prev) => Math.max(1, prev - 1));
                  }
                }}
                disabled={loading || page <= 1}
                style={{ padding: "4px 12px" }}
              >
                {t("dataBrowser.previousPage")}
              </button>
              <label style={{ margin: 0, fontSize: "12px" }}>{t("dataBrowser.pagination")}</label>
              <input
                type="number"
                className="form-control"
                style={{ width: "100px", padding: "4px 8px" }}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={commitPage}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitPage();
                    (event.target as HTMLElement).blur();
                  }
                }}
                min={1}
                disabled={loading}
              />
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                / {Math.ceil(total / size) || 1} {t("dataBrowser.of")}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setPage((prev) => prev + 1);
                }}
                disabled={loading}
                style={{ padding: "4px 12px" }}
              >
                {t("dataBrowser.nextPage")}
              </button>
              <span style={{ color: "#cbd5e1" }}>|</span>
              <label style={{ margin: 0, fontSize: "12px" }}>{t("dataBrowser.pageSize")}</label>
              <input
                type="number"
                className="form-control"
                style={{ width: "80px", padding: "4px 8px" }}
                value={sizeInput}
                onChange={(event) => setSizeInput(event.target.value)}
                onBlur={commitSize}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitSize();
                    (event.target as HTMLElement).blur();
                  }
                }}
                min={1}
                disabled={loading}
              />
              {(page - 1) * size >= 10000 && (
                <span style={{ fontSize: "11px", color: "#f59e0b", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px" }}>
                  ⚠️ {t("dataBrowser.deepPaging")}
                </span>
              )}
            </div>
          </div>
          <div className="flex-gap items-center">
            {loading && (
              <span style={{ fontSize: "13px", color: "#3b82f6", background: "#eff6ff", padding: "6px 12px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                ⏳ {loadingMessage || t("dataBrowser.querying")}
              </span>
            )}
            {error && <span className="text-danger" style={{ fontSize: "13px" }}>{error}</span>}
            {!error && !loading && <span className="muted" style={{ background: "white", padding: "6px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>{t("dataBrowser.total")}: <strong>{total}{totalRelation === "gte" ? "+" : ""}</strong> {t("dataBrowser.hits")}</span>}
            <FieldFilterButton
              allFields={filterCandidateFields}
              state={fieldFilter}
              onChange={setFieldFilter}
              align="right"
              label={t("dataBrowser.fieldFilter")}
            />
          </div>
        </div>

        <EsDataBrowserResults
          allColumns={allColumns}
          expandedRows={expandedRows}
          renderCellValue={renderCellValue}
          rows={rows}
          selectedDocs={selectedDocs}
          selectedRows={selectedRows}
          t={t}
          viewMode={viewMode}
          onCopySelected={copySelectedDocs}
          onDeleteSelected={deleteSelectedDocs}
          onDeleteDoc={requestDeleteDoc}
          onEditDoc={openEdit}
          onSelectAllRows={toggleSelectAllRows}
          onSelectRow={toggleSelectRow}
          onSetViewMode={setViewMode}
          onToggleRowExpand={toggleRowExpand}
          onRowContextMenu={handleContextMenu}
        />

        <EsDataBrowserContextMenu
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          expandedRows={expandedRows}
          t={t}
          onAddCondition={handleAddCondition}
          onAddSort={handleAddSort}
          onCopyRow={copyRow}
          onCopyValue={copyValue}
          onDeleteRow={handleDeleteRow}
          onEditRow={handleEditRow}
          onToggleRowExpand={() => toggleRowExpand(contextMenu.row._id)}
        />

        <EsDataBrowserDialogs
          deleteConfirmDialog={deleteConfirmDialog}
          editJson={editJson}
          editingDoc={editingDoc}
          error={error}
          showEditModal={showEditModal}
          t={t}
          onChangeEditJson={setEditJson}
          onCloseDeleteDialog={() => setDeleteConfirmDialog(null)}
          onCloseEditModal={() => setShowEditModal(false)}
          onConfirmDelete={(docIndex, docId) => {
            void confirmDeleteDoc(docIndex, docId);
          }}
          onSubmitEdit={submitEdit}
        />
      </div>
    </ConfigProvider>
  );
}
