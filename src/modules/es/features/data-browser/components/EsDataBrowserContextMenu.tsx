import type { TFunction } from "i18next";
import type { RefObject } from "react";
import type { BoolType, ContextMenuState, SortDirection } from "../types";

interface EsDataBrowserContextMenuProps {
  contextMenu: ContextMenuState;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  expandedRows: Set<string>;
  t: TFunction;
  onAddCondition: (boolType: BoolType) => void;
  onAddSort: (direction: SortDirection) => void;
  onCopyRow: () => void;
  onCopyValue: () => void;
  onDeleteRow: () => void;
  onEditRow: () => void;
  onToggleRowExpand: () => void;
}

export function EsDataBrowserContextMenu({
  contextMenu,
  contextMenuRef,
  expandedRows,
  t,
  onAddCondition,
  onAddSort,
  onCopyRow,
  onCopyValue,
  onDeleteRow,
  onEditRow,
  onToggleRowExpand,
}: EsDataBrowserContextMenuProps) {
  if (!contextMenu.visible) {
    return null;
  }

  return (
    <div
      ref={contextMenuRef}
      className="context-menu"
      style={{
        position: "fixed",
        top: contextMenu.y,
        left: contextMenu.x,
        zIndex: 2000,
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        minWidth: "180px",
        padding: "4px 0",
        fontSize: "13px",
      }}
    >
      <div
        className="context-menu-item"
        onClick={onCopyValue}
        style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
        onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
        onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
      >
        <span>📋</span> {t("dataBrowser.copyValue")}
      </div>
      <div
        className="context-menu-item"
        onClick={onCopyRow}
        style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
        onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
        onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
      >
        <span>📋</span> {t("dataBrowser.copyRow")}
      </div>

      <div style={{ height: "1px", background: "#e2e8f0", margin: "4px 0" }} />

      <div
        className="context-menu-item"
        onClick={onEditRow}
        style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
        onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
        onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
      >
        <span>✏️</span> {t("common.edit")}
      </div>
      <div
        className="context-menu-item"
        onClick={onDeleteRow}
        style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", color: "#ef4444" }}
        onMouseEnter={(event) => (event.currentTarget.style.background = "#fef2f2")}
        onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
      >
        <span>🗑️</span> {t("common.delete")}
      </div>

      <div style={{ height: "1px", background: "#e2e8f0", margin: "4px 0" }} />

      <div
        className="context-menu-item"
        onClick={onToggleRowExpand}
        style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
        onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
        onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
      >
        <span>{expandedRows.has(contextMenu.row?._id ?? "") ? "🔼" : "🔽"}</span>
        {expandedRows.has(contextMenu.row?._id ?? "") ? t("dataBrowser.collapseRow") : t("dataBrowser.expandRow")}
      </div>

      {contextMenu.field && contextMenu.field !== "_id" && (
        <>
          <div style={{ height: "1px", background: "#e2e8f0", margin: "4px 0" }} />

          <div style={{ height: "1px", background: "#e2e8f0", margin: "4px 0" }} />
          <div
            className="context-menu-item"
            onClick={() => onAddCondition("must")}
            style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", paddingLeft: "24px" }}
            onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
          >
            <span>✅</span> {t("dataBrowser.addMustCondition")}
          </div>
          <div
            className="context-menu-item"
            onClick={() => onAddCondition("should")}
            style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", paddingLeft: "24px" }}
            onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
          >
            <span>🔶</span> {t("dataBrowser.addShouldCondition")}
          </div>
          <div
            className="context-menu-item"
            onClick={() => onAddCondition("must_not")}
            style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", paddingLeft: "24px" }}
            onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
          >
            <span>❌</span> {t("dataBrowser.addMustNotCondition")}
          </div>

          <div style={{ height: "1px", background: "#e2e8f0", margin: "4px 0" }} />

          <div
            className="context-menu-item"
            onClick={() => onAddSort("asc")}
            style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", paddingLeft: "24px" }}
            onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
          >
            <span>⬆️</span> {t("dataBrowser.sortAscending")}
          </div>
          <div
            className="context-menu-item"
            onClick={() => onAddSort("desc")}
            style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", paddingLeft: "24px" }}
            onMouseEnter={(event) => (event.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
          >
            <span>⬇️</span> {t("dataBrowser.sortDescending")}
          </div>
        </>
      )}
    </div>
  );
}