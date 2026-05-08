import { useMemo, useRef, useState } from "react";
import type { ColumnMeta } from "../../../types";
import {
  type BatchEditMode,
  type ColumnEditForm,
  type ColumnEditMode,
  type ColumnHeaderContextMenu,
  type DataState,
  type FilterGroupDraft,
  type IndexFormState,
  type RightPanelTab,
  type RowContextMenu,
  type SelectedCell,
  type SortDraft,
  type TableInfo,
  type TableManagerConfirmDialogState,
  type TableManagerIndex,
  type TableSelectionAnchor,
  type TreeContextMenu,
} from "../types";
import { defaultDataState } from "../utils";

const DEFAULT_COLUMN_EDIT_FORM: ColumnEditForm = {
  field: "",
  typeName: "varchar",
  length: "255",
  scale: "",
  unsigned: false,
  customType: "",
  nullable: true,
  defaultValue: "",
  extra: "",
  autoIncrement: false
};

const DEFAULT_CONFIRM_DIALOG: TableManagerConfirmDialogState = {
  open: false,
  title: "",
  message: "",
  onConfirm: () => {},
  isDangerous: false
};

const DEFAULT_INDEX_FORM_DATA: IndexFormState = {
  name: "",
  columns: [],
  unique: false,
  indexType: "BTREE"
};

const DEFAULT_SORT_DRAFT: SortDraft = {
  column: "",
  direction: "asc"
};

export function useTableManagerState() {
  const [selectedTableInfo, setSelectedTableInfo] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("structure");
  const [treeContextMenu, setTreeContextMenu] = useState<TreeContextMenu | null>(null);
  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenu | null>(null);
  const [columnHeaderContextMenu, setColumnHeaderContextMenu] = useState<ColumnHeaderContextMenu | null>(null);
  const [selectedOverviewTables, setSelectedOverviewTables] = useState<string[]>([]);
  const [overviewSelectionAnchor, setOverviewSelectionAnchor] = useState<string | null>(null);

  const selectedOverviewTablesRef = useRef<string[]>([]);
  const latestDataRequestRef = useRef(0);
  const activeDataRequestKeyRef = useRef<string | null>(null);
  const currentLoadingTableKeyRef = useRef<string | null>(null);

  const [dataState, setDataState] = useState<DataState>(defaultDataState);
  const [dataColumnMeta, setDataColumnMeta] = useState<ColumnMeta[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<TableSelectionAnchor | null>(null);

  const [batchEditModalOpen, setBatchEditModalOpen] = useState(false);
  const [batchEditMode, setBatchEditMode] = useState<BatchEditMode>("text");
  const [batchEditValue, setBatchEditValue] = useState("");
  const [batchEditError, setBatchEditError] = useState("");

  const [addRowModalOpen, setAddRowModalOpen] = useState(false);
  const [addRowFormData, setAddRowFormData] = useState<Record<string, string>>({});
  const [addRowError, setAddRowError] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [filterDraftTree, setFilterDraftTree] = useState<FilterGroupDraft | null>(null);
  const [sortDraft, setSortDraft] = useState<SortDraft>(DEFAULT_SORT_DRAFT);

  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [sqlModalValue, setSqlModalValue] = useState("");
  const [sqlModalResult, setSqlModalResult] = useState("");
  const [sqlModalLoading, setSqlModalLoading] = useState(false);

  const [columnEditOpen, setColumnEditOpen] = useState(false);
  const [columnEditMode, setColumnEditMode] = useState<ColumnEditMode>("add");
  const [columnEditOriginalField, setColumnEditOriginalField] = useState("");
  const [columnEditForm, setColumnEditForm] = useState<ColumnEditForm>(DEFAULT_COLUMN_EDIT_FORM);
  const [columnEditLoading, setColumnEditLoading] = useState(false);
  const [columnEditError, setColumnEditError] = useState("");

  const [confirmDialog, setConfirmDialog] = useState<TableManagerConfirmDialogState>(DEFAULT_CONFIRM_DIALOG);

  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [indexModalMode, setIndexModalMode] = useState<"view" | "create" | "edit">("view");
  const [indexes, setIndexes] = useState<TableManagerIndex[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState("");
  const [indexFormData, setIndexFormData] = useState<IndexFormState>(DEFAULT_INDEX_FORM_DATA);

  const selectedCellKeySet = useMemo(() => new Set(selectedCells.map((cell) => cell.key)), [selectedCells]);
  const selectedRowCount = useMemo(() => new Set(selectedCells.map((cell) => cell.rowIndex)).size, [selectedCells]);

  return {
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
  };
}