import { useTranslation } from "react-i18next";

interface SqlResultColumnMenuProps {
  menu: { x: number; y: number } | null;
  columns: string[];
  visibleColumns: string[];
  onToggleColumn: (column: string) => void;
  onSelectAll: () => void;
}

export function SqlResultColumnMenu({
  menu,
  columns,
  visibleColumns,
  onToggleColumn,
  onSelectAll,
}: SqlResultColumnMenuProps) {
  const { t } = useTranslation();

  if (!menu) return null;

  return (
    <div
      className="context-menu-panel"
      style={{
        position: "fixed",
        left: `${menu.x}px`,
        top: `${menu.y}px`,
        zIndex: 9999,
        maxHeight: "400px",
        overflow: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn btn-sm btn-ghost context-menu-button"
        onClick={onSelectAll}
      >
        {t("common.selectAll")}
      </button>
      <div className="context-menu-separator" />
      {columns.map((col) => (
        <label
          key={col}
          className="context-menu-checkbox"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 12px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          <input
            type="checkbox"
            checked={visibleColumns.includes(col)}
            onChange={() => onToggleColumn(col)}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {col}
          </span>
        </label>
      ))}
    </div>
  );
}
