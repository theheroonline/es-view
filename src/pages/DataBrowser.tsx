import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import FieldFilterButton, { type FieldFilterState } from "../components/FieldFilterButton";
import { deleteDocument, extractFieldsFromMapping, getIndexMapping, refreshIndex, searchIndex, updateDocument } from "../lib/esView";
import { useAppContext } from "../state/AppContext";

type ViewMode = "table" | "json";
type BoolType = "must" | "should" | "must_not" | "sort";
type ConditionItem = {
  field: string;
  operator: string;
  value: string;
  boolType: BoolType;
  enabled: boolean;
  sortDirection?: "asc" | "desc"; // 当 boolType 为 sort 时使用
};
type SortDirection = "asc" | "desc";

// Context Menu State
type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  row: any;
  field?: string;
  value?: unknown;
};

export default function DataBrowser() {
  const { getActiveConnection, selectedIndex, setSelectedIndex, indices } = useAppContext();
  const activeConnection = useMemo(() => getActiveConnection(), [getActiveConnection]);
  const [fields, setFields] = useState<string[]>([]);
  const defaultCondition: ConditionItem = { field: "", operator: "term", value: "", boolType: "must", enabled: true };
  const [conditions, setConditions] = useState<ConditionItem[]>(() => [{ ...defaultCondition }]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [sizeInput, setSizeInput] = useState(String(10));
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Edit State
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [editJson, setEditJson] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    row: null
  });
  const [showIndexDropdown, setShowIndexDropdown] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const indexDropdownRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Field Filter State (shared component)
  const [fieldFilter, setFieldFilter] = useState<FieldFilterState>({ enabled: false, fields: [] });
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  // Close index dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (indexDropdownRef.current && !indexDropdownRef.current.contains(e.target as Node)) {
        setShowIndexDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  // Context Menu Handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, row: any, field?: string, value?: unknown) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      row,
      field,
      value
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    closeContextMenu();
  }, [closeContextMenu]);

  const copyValue = useCallback(() => {
    if (contextMenu.value !== undefined) {
      const text = typeof contextMenu.value === 'object' 
        ? JSON.stringify(contextMenu.value) 
        : String(contextMenu.value);
      copyToClipboard(text);
    }
    closeContextMenu();
  }, [contextMenu.value, copyToClipboard, closeContextMenu]);

  const copyRow = useCallback(() => {
    if (contextMenu.row) {
      copyToClipboard(JSON.stringify(contextMenu.row._source, null, 2));
    }
  }, [contextMenu.row, copyToClipboard]);

  const toggleRowExpand = useCallback((docId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
    closeContextMenu();
  }, [closeContextMenu]);

  const addConditionFromContext = useCallback((boolType: BoolType) => {
    if (contextMenu.field && contextMenu.value !== undefined) {
      const valueStr = typeof contextMenu.value === 'object' 
        ? JSON.stringify(contextMenu.value) 
        : String(contextMenu.value);
      setConditions(prev => [...prev, { 
        field: contextMenu.field!, 
        operator: "term", 
        value: valueStr, 
        boolType, 
        enabled: true 
      }]);
    }
    closeContextMenu();
  }, [contextMenu.field, contextMenu.value, closeContextMenu]);

  const addSortFromContext = useCallback((direction: SortDirection) => {
    if (contextMenu.field) {
      setConditions(prev => [...prev, { 
        field: contextMenu.field!, 
        operator: "term", 
        value: "", 
        boolType: "sort", 
        enabled: true,
        sortDirection: direction
      }]);
    }
    closeContextMenu();
  }, [contextMenu.field, closeContextMenu]);

  useEffect(() => {
    if (!activeConnection || !selectedIndex) {
      setFields([]);
      return;
    }
    getIndexMapping(activeConnection, selectedIndex)
      .then((mapping) => {
        const extracted = extractFieldsFromMapping(mapping, selectedIndex);
        setFields(extracted);
      })
      .catch(() => setFields([]));
  }, [activeConnection, selectedIndex]);

  const handleIndexChange = (index: string) => {
    setSelectedIndex(index || undefined);
    setConditions([{ ...defaultCondition }]);
    setResult(null);
  };

  useEffect(() => {
    setConditions([{ ...defaultCondition }]);
    setResult(null);
  }, [selectedIndex]);

  // 当索引改变时自动执行查询
  useEffect(() => {
    if (selectedIndex && activeConnection) {
      execute();
    }
  }, [selectedIndex, activeConnection]);

  // 当页码或每页数改变时自动执行查询
  useEffect(() => {
    if (selectedIndex && activeConnection && page > 0 && size > 0) {
      execute();
    }
  }, [page, size, selectedIndex, activeConnection]);

  // 同步 size -> sizeInput（当 size 被程序性更新时）
  useEffect(() => {
    setSizeInput(String(size));
  }, [size]);

  const commitSize = () => {
    const parsed = Number.parseInt(sizeInput, 10);
    const next = Number.isNaN(parsed) ? size : Math.max(1, parsed);
    if (next !== size) {
      setSize(next);
      setPage(1); // 改变每页大小后回到第一页，避免越界
    } else {
      // 如果未变更但输入非法（如空），恢复显示
      setSizeInput(String(size));
    }
  };

  const handleConditionChange = (idx: number, next: Partial<ConditionItem>) => {
    setConditions((prev) => prev.map((item, index) => (index === idx ? { ...item, ...next } : item)));
  };

  const addCondition = (idx?: number) => {
    setConditions((prev) => {
      const next = [...prev];
      const insertIndex = idx !== undefined ? idx + 1 : next.length;
      next.splice(insertIndex, 0, { ...defaultCondition });
      return next;
    });
  };

  const removeCondition = (idx: number) => {
    setConditions((prev) => {
      if (prev.length === 1) {
        return [{ ...defaultCondition }];
      }
      return prev.filter((_, index) => index !== idx);
    });
  };

  const toggleCondition = (idx: number) => {
    setConditions((prev) => prev.map((item, index) => (index === idx ? { ...item, enabled: !item.enabled } : item)));
  };



  const handleDeleteDoc = async (docIndex: string, docId: string) => {
      if (!activeConnection) return;
      if (!confirm(`确定删除文档 ${docId} ?`)) return;
      try {
          setLoading(true);
          setError("");
          await deleteDocument(activeConnection, docIndex, docId);
          await refreshIndex(activeConnection, docIndex);
          setSelectedDocs((prev) => {
            const next = new Set(prev);
            next.delete(docId);
            return next;
          });
          // 重新执行查询并等待完成
          const response = await executeQuery();
          setResult(response);
      } catch (e) {
          setError("删除失败：" + (e instanceof Error ? e.message : String(e)));
      } finally {
          setLoading(false);
      }
  };

  const openEdit = (row: any) => {
      setEditingDoc(row);
      setEditJson(JSON.stringify(row._source, null, 2));
      setShowEditModal(true);
  };

  // 查询逻辑函数，不修改状态，直接返回结果
  const executeQuery = async () => {
    if (!activeConnection) {
      throw new Error("请先设置当前连接");
    }
    if (!selectedIndex) {
      throw new Error("请选择索引");
    }
    
    const activeConditions = conditions.filter((item) => item.enabled && item.boolType !== "sort" && item.field && item.value);
    const activeSorts = conditions.filter((item) => item.enabled && item.boolType === "sort" && item.field);
    
    let query: any = { match_all: {} };
    const boolBuckets: Record<string, any[]> = { must: [], should: [], must_not: [] };
    for (const item of activeConditions) {
      let parsed: unknown;
      if (item.operator === "range") {
        try {
          parsed = JSON.parse(item.value);
        } catch {
          throw new Error("范围查询请输入 JSON，例如 {\"gte\":10,\"lte\":20 }");
        }
      }
      if (item.operator === "term") {
        boolBuckets[item.boolType]?.push({ term: { [item.field]: item.value } });
      } else if (item.operator === "match") {
        boolBuckets[item.boolType]?.push({ match: { [item.field]: item.value } });
      } else if (item.operator === "range") {
        boolBuckets[item.boolType]?.push({ range: { [item.field]: parsed } });
      }
    }
    const boolQuery: Record<string, any[]> = {};
    for (const key of Object.keys(boolBuckets)) {
      if (boolBuckets[key].length > 0) {
        boolQuery[key] = boolBuckets[key];
      }
    }
    if (Object.keys(boolQuery).length > 0) {
      query = { bool: boolQuery };
    }

    const from = (page - 1) * size;
    let sortParams = activeSorts.map((item) => ({ [item.field]: { order: item.sortDirection || "asc" } }));
    if (sortParams.length === 0) {
      sortParams = [{ _id: { order: "asc" } }];
    } else {
      sortParams.push({ _id: { order: "asc" } });
    }

    // 简化版：直接使用普通分页返回结果
    if (from + size <= 10000) {
      const body: Record<string, unknown> = {
        from,
        size,
        query,
        sort: sortParams,
        track_total_hits: true
      };
      return await searchIndex(activeConnection, selectedIndex, body);
    }
    
    throw new Error("深度分页查询暂时不支持快速刷新");
  };

  const handleUpdateDoc = async () => {
      if (!activeConnection || !editingDoc) return;
      try {
          setLoading(true);
          setError("");
          const body = JSON.parse(editJson);
          await updateDocument(activeConnection, editingDoc._index, editingDoc._id, body);
          await refreshIndex(activeConnection, editingDoc._index);
          setShowEditModal(false);
          setEditingDoc(null);
          // 重新执行查询并等待完成
          const response = await executeQuery();
          setResult(response);
      } catch (e) {
          setError("更新失败：" + (e instanceof Error ? e.message : "请检查JSON格式"));
      } finally {
          setLoading(false);
      }
  };

  const execute = async () => {
    setError("");
    setResult(null);
    setLoading(true);
    setLoadingMessage("");
    
    if (!activeConnection) {
      setError("请先设置当前连接");
      setLoading(false);
      return;
    }
    if (!selectedIndex) {
      setError("请选择索引");
      setLoading(false);
      return;
    }
    
    // 分离查询条件和排序条件
    const activeConditions = conditions.filter((item) => item.enabled && item.boolType !== "sort" && item.field && item.value);
    const activeSorts = conditions.filter((item) => item.enabled && item.boolType === "sort" && item.field);
    
    let query: any = { match_all: {} };
    const boolBuckets: Record<string, any[]> = { must: [], should: [], must_not: [] };
    for (const item of activeConditions) {
      let parsed: unknown;
      if (item.operator === "range") {
        try {
          parsed = JSON.parse(item.value);
        } catch {
          setError("范围查询请输入 JSON，例如 {\"gte\":10,\"lte\":20 }");
          setLoading(false);
          return;
        }
      }
      if (item.operator === "term") {
        boolBuckets[item.boolType]?.push({ term: { [item.field]: item.value } });
      } else if (item.operator === "match") {
        boolBuckets[item.boolType]?.push({ match: { [item.field]: item.value } });
      } else if (item.operator === "range") {
        boolBuckets[item.boolType]?.push({ range: { [item.field]: parsed } });
      }
    }
    const boolQuery: Record<string, any[]> = {};
    for (const key of Object.keys(boolBuckets)) {
      if (boolBuckets[key].length > 0) {
        boolQuery[key] = boolBuckets[key];
      }
    }
    if (Object.keys(boolQuery).length > 0) {
      query = { bool: boolQuery };
    }

    const from = (page - 1) * size;
    
    // 构建排序参数，从activeSorts中获取
    let sortParams = activeSorts.map((item) => ({ [item.field]: { order: item.sortDirection || "asc" } }));
    if (sortParams.length === 0) {
      sortParams = [{ _id: { order: "asc" } }];
    } else {
      // 添加 _id 作为最后的排序字段，确保 search_after 的稳定性
      sortParams.push({ _id: { order: "asc" } });
    }

    try {
      // 如果 from + size <= 10000，使用普通分页
      if (from + size <= 10000) {
        const body: Record<string, unknown> = {
          from,
          size,
          query,
          sort: sortParams,
          track_total_hits: true
        };
        const data = await searchIndex(activeConnection, selectedIndex, body);
        setResult(data);
      } else {
        // 超过 10000，使用 search_after 深度分页
        setLoadingMessage(`正在查询第 ${page} 页数据（深度分页模式，请稍候...）`);
        
        // 计算需要跳过多少批次
        const batchSize = 1000; // 每批获取 1000 条
        const targetFrom = from;
        let currentPosition = 0;
        let searchAfter: any[] | undefined = undefined;
        
        // 先快速跳到目标位置附近
        while (currentPosition + batchSize < targetFrom) {
          const skipBody: Record<string, unknown> = {
            size: batchSize,
            query,
            sort: sortParams,
            track_total_hits: true,
            _source: false // 只获取排序字段，减少数据传输
          };
          if (searchAfter) {
            skipBody.search_after = searchAfter;
          }
          
          setLoadingMessage(`正在跳过前 ${currentPosition + batchSize} 条数据...`);
          const skipResult = await searchIndex(activeConnection, selectedIndex, skipBody);
          const hits = skipResult?.hits?.hits ?? [];
          
          if (hits.length === 0) {
            // 没有更多数据
            break;
          }
          
          // 获取最后一条的排序值
          searchAfter = hits[hits.length - 1]?.sort;
          currentPosition += hits.length;
          
          if (hits.length < batchSize) {
            // 数据不够，说明已经到末尾
            break;
          }
        }
        
        // 跳过剩余的记录
        const remaining = targetFrom - currentPosition;
        if (remaining > 0 && searchAfter) {
          const skipBody: Record<string, unknown> = {
            size: remaining,
            query,
            sort: sortParams,
            track_total_hits: true,
            _source: false
          };
          skipBody.search_after = searchAfter;
          
          setLoadingMessage(`正在定位到第 ${targetFrom} 条...`);
          const skipResult = await searchIndex(activeConnection, selectedIndex, skipBody);
          const hits = skipResult?.hits?.hits ?? [];
          
          if (hits.length > 0) {
            searchAfter = hits[hits.length - 1]?.sort;
          }
        }
        
        // 获取目标页数据
        setLoadingMessage(`正在获取第 ${page} 页数据...`);
        const finalBody: Record<string, unknown> = {
          size,
          query,
          sort: sortParams,
          track_total_hits: true
        };
        if (searchAfter) {
          finalBody.search_after = searchAfter;
        }
        
        const data = await searchIndex(activeConnection, selectedIndex, finalBody);
        setResult(data);
      }
    } catch (err) {
      setError("查询失败：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const totalInfo = result?.hits?.total;
  const total = totalInfo?.value ?? totalInfo ?? 0;
  const totalRelation = totalInfo?.relation; // "eq" 或 "gte"
  const rows = result?.hits?.hits ?? [];

  useEffect(() => {
    if (selectedDocs.size === 0) return;
    const validIds = new Set(rows.map((row: any) => row._id));
    const next = new Set(Array.from(selectedDocs).filter((id) => validIds.has(id)));
    if (next.size !== selectedDocs.size) {
      setSelectedDocs(next);
    }
  }, [rows, selectedDocs]);

  // 从结果中提取所有字段用于表格显示
  const allAvailableColumns = useMemo(() => {
    if (rows.length === 0) return [];
    const colSet = new Set<string>();
    rows.forEach((row: any) => {
      Object.keys(row._source || {}).forEach((key) => colSet.add(key));
    });
    return Array.from(colSet);
  }, [rows]);

  const filterCandidateFields = useMemo(() => {
    // 优先使用 mapping 字段；若未加载 mapping，则回退到本页数据字段
    return fields.length > 0 ? fields : allAvailableColumns;
  }, [fields, allAvailableColumns]);

  // 实际显示的字段：未启用过滤时显示全部；启用后显示选中的字段（按 mapping 顺序）
  const allColumns = useMemo(() => {
    if (!fieldFilter.enabled) return filterCandidateFields;
    // 仅保留仍存在于候选列表中的字段，避免索引切换后出现无效字段
    return fieldFilter.fields.filter((f) => filterCandidateFields.includes(f));
  }, [fieldFilter.enabled, fieldFilter.fields, filterCandidateFields]);

  const selectedRows = rows.filter((row: any) => selectedDocs.has(row._id));
  const isAllRowsSelected = rows.length > 0 && selectedDocs.size === rows.length;

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
      ...row._source
    }));
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  const deleteSelectedDocs = async () => {
    if (selectedRows.length === 0 || !activeConnection) return;
    if (!confirm(`确定删除 ${selectedRows.length} 条选中文档？`)) return;
    try {
      setLoading(true);
      for (const row of selectedRows) {
        await deleteDocument(activeConnection, row._index, row._id);
      }
      if (selectedIndex) {
        await refreshIndex(activeConnection, selectedIndex);
      }
      setSelectedDocs(new Set());
      await execute();
    } catch (err) {
      setError("删除失败：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const renderCellValue = (val: unknown, truncate = true) => {
    if (val === null || val === undefined) return <span className="muted">-</span>;

    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    const shouldTruncate = truncate && str.length > 80;
    const preview = shouldTruncate ? `${str.substring(0, 80)}...` : str;

    return (
      <span className="truncated-cell" title={str} data-truncated={shouldTruncate ? "true" : "false"}>
        <span className="truncated-text">{preview}</span>
      </span>
    );
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '24px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
          <h1 className="page-title" style={{ margin: 0 }}>数据浏览</h1>
          <div 
            ref={indexDropdownRef}
            style={{ 
              position: 'relative',
              minWidth: '300px'
            }}
          >
            <button
              onClick={() => setShowIndexDropdown(!showIndexDropdown)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                background: 'white',
                padding: '10px 12px',
                borderRadius: '8px',
                border: selectedIndex ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                width: '100%',
                fontSize: '14px',
                fontWeight: selectedIndex ? '600' : '400',
                color: selectedIndex ? '#1e293b' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '18px' }}>📑</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                {selectedIndex || '选择索引...'}
              </span>
              <span style={{ fontSize: '12px' }}>
                {showIndexDropdown ? '▲' : '▼'}
              </span>
            </button>

            {showIndexDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  zIndex: 1000,
                }}
              >
                {indices.length === 0 ? (
                  <div style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px' }}>
                    暂无索引
                  </div>
                ) : (
                  indices
                    .filter((item) => !item.startsWith('.')) // 过滤掉 ES 系统索引
                    .sort()
                    .map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        handleIndexChange(item);
                        setShowIndexDropdown(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '10px 16px',
                        background: selectedIndex === item ? '#eff6ff' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '14px',
                        color: selectedIndex === item ? '#1e40af' : '#334155',
                        fontWeight: selectedIndex === item ? '600' : '400',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedIndex !== item) {
                          (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedIndex !== item) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }
                      }}
                    >
                      {selectedIndex === item && <span>✓</span>}
                      {selectedIndex !== item && <span style={{ width: '16px' }}></span>}
                      <span>{item}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">查询条件</h3>
          <div className="flex-gap">
            <button className="btn btn-primary btn-sm" onClick={execute} disabled={loading}>
              <span>{loading ? '⏳' : '🔍'}</span> {loading ? '查询中...' : '查询'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => addCondition()} disabled={loading}>
              <span>+</span> 添加
            </button>
          </div>
        </div>
        
        <div className="card-body">
          {/* Condition Builder */}
          <div>
            <div className="query-builder-header-row">
              <div className="col-header">类型</div>
              <div className="col-header">字段</div>
              <div className="col-header">操作符/方向</div>
              <div className="col-header">值</div>
              <div className="col-header">操作</div>
            </div>

            {conditions.map((item, idx) => (
              <div key={`cond-${idx}`} className={`query-row ${item.enabled ? "" : "disabled"}`}>
                {/* Logic Group / Type */}
                <div className="logic-group">
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={item.enabled} 
                      onChange={() => toggleCondition(idx)} 
                    />
                    <span className="slider"></span>
                  </label>
                  <select 
                    className="form-control" 
                    style={{ width: '70px', padding: '2px 6px', fontSize: '12px', height: '28px' }}
                    value={item.boolType} 
                    onChange={(event) => handleConditionChange(idx, { boolType: event.target.value as BoolType })}
                  >
                    <option value="must">Must</option>
                    <option value="should">Should</option>
                    <option value="must_not">Not</option>
                    <option value="sort">排序</option>
                  </select>
                </div>

                {/* Field */}
                <div>
                  <select 
                    className="form-control"
                    value={item.field} 
                    onChange={(event) => handleConditionChange(idx, { field: event.target.value })}
                  >
                    <option value="">选择字段</option>
                    {fields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Operator / Sort Direction */}
                <div>
                  {item.boolType === "sort" ? (
                    <select 
                      className="form-control"
                      value={item.sortDirection || "asc"} 
                      onChange={(event) => handleConditionChange(idx, { sortDirection: event.target.value as SortDirection })}
                    >
                      <option value="asc">升序 ↑</option>
                      <option value="desc">降序 ↓</option>
                    </select>
                  ) : (
                    <select 
                      className="form-control"
                      value={item.operator} 
                      onChange={(event) => handleConditionChange(idx, { operator: event.target.value })}
                    >
                      <option value="term">等于 (term)</option>
                      <option value="match">包含 (match)</option>
                      <option value="range">范围 (range)</option>
                    </select>
                  )}
                </div>

                {/* Value */}
                <div>
                  {item.boolType === "sort" ? (
                    <span className="form-control" style={{ background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }}>-</span>
                  ) : (
                    <input 
                      className="form-control"
                      value={item.value} 
                      onChange={(event) => handleConditionChange(idx, { value: event.target.value })} 
                      placeholder="输入查询值..." 
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="flex-gap justify-end">
                   <button className="btn btn-ghost btn-icon" onClick={() => addCondition(idx)} title="添加行">+</button>
                   <button className="btn btn-ghost btn-icon text-danger" onClick={() => removeCondition(idx)} title="删除行">−</button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Pagination & Stats Toolbar */}
      <div className="toolbar" style={{ margin: '0 0 16px 0', border: 'none', background: 'transparent', padding: 0, position: 'relative' }}>
        <div className="flex-gap items-center">
             <div className="flex-gap items-center" style={{ background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (page > 1) {
                      setPage(page - 1);
                    }
                  }}
                  disabled={loading || page <= 1}
                  style={{ padding: '4px 12px' }}
                >
                  ← 上一页
                </button>
                <label style={{ margin: 0, fontSize: '12px' }}>页码</label>
                <input 
                  type="number" 
                  className="form-control"
                  style={{ width: '100px', padding: '4px 8px' }}
                  value={page} 
                  onChange={(event) => setPage(Number(event.target.value))} 
                  min={1} 
                  disabled={loading}
                />
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  / {Math.ceil(total / size) || 1}页
                </span>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setPage(page + 1);
                  }}
                  disabled={loading}
                  style={{ padding: '4px 12px' }}
                >
                  下一页 →
                </button>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <label style={{ margin: 0, fontSize: '12px' }}>每页</label>
                <input 
                  type="number" 
                  className="form-control"
                  style={{ width: '80px', padding: '4px 8px' }}
                  value={sizeInput} 
                  onChange={(event) => setSizeInput(event.target.value)} 
                  onBlur={commitSize}
                  onKeyDown={(e) => { if (e.key === 'Enter') { commitSize(); (e.target as HTMLElement).blur(); } }}
                  min={1} 
                  disabled={loading}
                />
                {(page - 1) * size >= 10000 && (
                  <span style={{ 
                    fontSize: '11px', 
                    color: '#f59e0b', 
                    background: '#fef3c7', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    marginLeft: '8px'
                  }}>
                    ⚠️ 深度分页
                  </span>
                )}
             </div>
        </div>
        <div className="flex-gap items-center">
             {loading && (
               <span style={{ 
                 fontSize: '13px', 
                 color: '#3b82f6',
                 background: '#eff6ff',
                 padding: '6px 12px',
                 borderRadius: '8px',
                 border: '1px solid #bfdbfe'
               }}>
                 ⏳ {loadingMessage || '查询中...'}
               </span>
             )}
             {error && <span className="text-danger" style={{ fontSize: '13px' }}>{error}</span>}
             {!error && !loading && <span className="muted" style={{ background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>Total: <strong>{total}{totalRelation === 'gte' ? '+' : ''}</strong> hits</span>}
             <FieldFilterButton
               allFields={filterCandidateFields}
               state={fieldFilter}
               onChange={setFieldFilter}
               align="right"
               label="字段过滤"
             />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">查询结果</h3>
          <div className="flex-gap" style={{ alignItems: 'center' }}>
            <div className="flex-gap" style={{ gap: '4px' }}>
              <button className="btn btn-sm btn-secondary" onClick={copySelectedDocs} disabled={selectedRows.length === 0}>复制选中</button>
              <button className="btn btn-sm btn-secondary" onClick={deleteSelectedDocs} disabled={selectedRows.length === 0}>删除选中</button>
              {/* <span className="muted" style={{ fontSize: '12px' }}>{selectedRows.length > 0 ? `已选 ${selectedRows.length} 条` : ''}</span> */}
            </div>
            <div className="flex-gap">
              <button className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("table")}>表格</button>
              <button className={`btn btn-sm ${viewMode === "json" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("json")}>JSON</button>
            </div>
          </div>
        </div>
          
        {rows.length === 0 ? (
          <div className="card-body">
            <p className="muted" style={{ textAlign: 'center', margin: '20px 0' }}>暂无数据</p>
          </div>
        ) : (
          <div>
            {viewMode === "table" && (
              <div>
                <div className="table-wrapper">
                  <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '42px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isAllRowsSelected} 
                          onChange={(event) => toggleSelectAllRows(event.target.checked)}
                        />
                      </th>
                      <th style={{ width: '50px' }}></th>
                      <th style={{ width: '120px' }}>_id</th>
                      {allColumns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                      <th style={{ width: '140px', textAlign: 'right' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row: any) => (
                      <Fragment key={row._id}>
                        <tr 
                          onContextMenu={(e) => handleContextMenu(e, row)}
                          className={expandedRows.has(row._id) ? 'row-expanded' : ''}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedDocs.has(row._id)}
                              onChange={() => toggleSelectRow(row._id)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn btn-ghost btn-icon" 
                              onClick={() => toggleRowExpand(row._id)}
                              style={{ fontSize: '10px', padding: '2px 6px' }}
                            >
                              {expandedRows.has(row._id) ? '▼' : '▶'}
                            </button>
                          </td>
                          <td onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, row, '_id', row._id); }}>{row._id}</td>
                          {allColumns.map((col) => (
                            <td 
                              key={col} 
                              onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, row, col, row._source?.[col]); }}
                            >
                              {renderCellValue(row._source?.[col])}
                            </td>
                          ))}
                          <td className="table-actions" style={{ textAlign: 'right' }}>
                            <div className="flex-gap justify-end" style={{ gap: '4px' }}>
                               <button className="btn btn-sm btn-ghost" onClick={() => openEdit(row)}>编辑</button>
                               <button className="btn btn-sm btn-ghost text-danger" onClick={() => handleDeleteDoc(row._index, row._id)}>删除</button>
                            </div>
                          </td>
                        </tr>
                        {expandedRows.has(row._id) && (
                          <tr className="expanded-row">
                            <td colSpan={allColumns.length + 4} style={{ background: '#f8fafc', padding: '12px 16px' }}>
                              <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(row._source, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewMode === "json" && (
              <div>
                <div style={{ 
                  padding: '12px 16px', 
                  background: '#eff6ff', 
                  border: '1px solid #bfdbfe', 
                  borderRadius: '8px',
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#1e40af'
                }}>
                  💡 提示：JSON 视图展示完整的文档数据
                </div>
                <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>ID</th>
                      <th>Source JSON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row: any) => (
                      <tr key={row._id}>
                        <td>{row._id}</td>
                        <td>
                          <pre style={{ margin: 0, fontSize: '12px' }}>{JSON.stringify(row._source, null, 2)}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Document Modal */}
      {showEditModal && editingDoc && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card anim-fade-in" style={{ width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
             <div className="card-header">
                <h3 className="card-title">编辑文档: {editingDoc._id}</h3>
             </div>
             <div className="card-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '12px' }}>
                   <label style={{ fontSize: '12px', color: '#64748b' }}>Index: {editingDoc._index}</label>
                </div>
                <textarea 
                   className="json-editor" 
                   style={{ flex: 1, minHeight: '300px' }}
                   value={editJson}
                   onChange={(e) => setEditJson(e.target.value)}
                />
                {error && <p className="text-danger" style={{ marginTop: '8px' }}>{error}</p>}
                <div className="flex-gap justify-end" style={{ marginTop: '16px' }}>
                   <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>取消</button>
                   <button className="btn btn-primary" onClick={handleUpdateDoc}>保存修改</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          ref={contextMenuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 2000,
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            minWidth: '180px',
            padding: '4px 0',
            fontSize: '13px'
          }}
        >
          {/* Copy Options */}
          <div 
            className="context-menu-item" 
            onClick={copyValue}
            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>📋</span> 复制
          </div>
          <div 
            className="context-menu-item" 
            onClick={copyRow}
            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>📋</span> 复制当前行
          </div>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

          {/* Edit & Delete */}
          <div 
            className="context-menu-item" 
            onClick={() => { openEdit(contextMenu.row); closeContextMenu(); }}
            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>✏️</span> 编辑
          </div>
          <div 
            className="context-menu-item" 
            onClick={() => { handleDeleteDoc(contextMenu.row._index, contextMenu.row._id); closeContextMenu(); }}
            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>🗑️</span> 删除
          </div>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

          {/* Expand/Collapse */}
          <div 
            className="context-menu-item" 
            onClick={() => toggleRowExpand(contextMenu.row._id)}
            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>{expandedRows.has(contextMenu.row?._id) ? '🔼' : '🔽'}</span> 
            {expandedRows.has(contextMenu.row?._id) ? '收起当前行' : '展开当前行'}
          </div>

          {/* Query Conditions - Only show when a field is selected */}
          {contextMenu.field && contextMenu.field !== '_id' && (
            <>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
              
              <div 
                className="context-menu-item context-menu-submenu"
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>✅</span> must</span>
                <span>▶</span>
                <div className="context-submenu" style={{
                  position: 'absolute', left: '100%', top: 0, background: 'white',
                  border: '1px solid #e2e8f0', borderRadius: '8px', minWidth: '120px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'none', padding: '4px 0'
                }}>
                  <div 
                    onClick={() => addConditionFromContext('must')}
                    style={{ padding: '8px 12px', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    添加条件
                  </div>
                </div>
              </div>
              <div 
                className="context-menu-item"
                onClick={() => addConditionFromContext('must')}
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>✅</span> 添加 must 条件
              </div>
              <div 
                className="context-menu-item"
                onClick={() => addConditionFromContext('should')}
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>🔶</span> 添加 should 条件
              </div>
              <div 
                className="context-menu-item"
                onClick={() => addConditionFromContext('must_not')}
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>❌</span> 添加 must_not 条件
              </div>

              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

              {/* Sort Options */}
              <div 
                className="context-menu-item"
                onClick={() => addSortFromContext('asc')}
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>⬆️</span> 升序排序
              </div>
              <div 
                className="context-menu-item"
                onClick={() => addSortFromContext('desc')}
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>⬇️</span> 降序排序
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
