import { useRef, useState } from "react";
import type { FieldFilterState } from "../components/FieldFilterButton";
import type { ConditionItem, ContextMenuState, ViewMode } from "../types";
import { createDefaultEsCondition } from "./useEsQueryConditions";

export function useEsDataBrowserState() {
  const [selectedIndex, setSelectedIndex] = useState<string | undefined>(undefined);
  const [showQueryConditions, setShowQueryConditions] = useState(false);
  const [fields, setFields] = useState<string[]>([]);
  const [conditions, setConditions] = useState<ConditionItem[]>(() => [createDefaultEsCondition()]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [sizeInput, setSizeInput] = useState(String(10));
  const [pageInput, setPageInput] = useState(String(1));
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [editJson, setEditJson] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ docIndex: string; docId: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    row: null,
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [fieldFilter, setFieldFilter] = useState<FieldFilterState>({ enabled: false, fields: [] });
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Create document
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDocId, setCreateDocId] = useState("");
  const [createDocJson, setCreateDocJson] = useState("{}");

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const skipNextAutoQueryRef = useRef(false);

  return {
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
    selectedRowId,
    setSelectedRowId,
    contextMenuRef,
    skipNextAutoQueryRef,
    // Create document
    showCreateModal,
    setShowCreateModal,
    createDocId,
    setCreateDocId,
    createDocJson,
    setCreateDocJson,
  };
}
