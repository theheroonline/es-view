import { useEffect, useMemo, useRef, useState } from "react";

export type FieldFilterState = {
  enabled: boolean;
  fields: string[];
};

type Props = {
  allFields: string[];
  state: FieldFilterState;
  onChange: (next: FieldFilterState) => void;
  align?: "left" | "right";
  label?: string;
};

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

export default function FieldFilterButton({
  allFields,
  state,
  onChange,
  align = "right",
  label = "字段过滤"
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const effectiveSelected = useMemo(() => {
    return state.enabled ? state.fields : allFields;
  }, [allFields, state.enabled, state.fields]);

  const selectedCount = state.enabled ? effectiveSelected.length : 0;

  const setEnabled = (enabled: boolean) => {
    if (enabled) {
      const nextFields = state.fields.length > 0 ? state.fields : allFields;
      onChange({ enabled: true, fields: uniq(nextFields) });
    } else {
      onChange({ enabled: false, fields: state.fields });
    }
  };

  const setAll = () => {
    onChange({ enabled: true, fields: uniq(allFields) });
  };

  const clearAll = () => {
    onChange({ enabled: true, fields: [] });
  };

  const clearFilter = () => {
    onChange({ enabled: false, fields: [] });
  };

  const toggleField = (field: string, checked: boolean) => {
    if (!state.enabled) return;

    if (checked) {
      onChange({ enabled: true, fields: uniq([...state.fields, field]) });
      return;
    }

    const next = state.fields.filter((f) => f !== field);
    onChange({ enabled: true, fields: next });
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        className="btn btn-sm btn-secondary"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: state.enabled ? "#007aff" : undefined,
          color: state.enabled ? "white" : undefined,
          borderColor: state.enabled ? "#007aff" : undefined
        }}
      >
        🔍 {label} {selectedCount > 0 && `(${selectedCount})`}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            [align]: 0,
            marginTop: "8px",
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
            minWidth: "300px",
            maxHeight: "420px",
            overflow: "auto",
            zIndex: 2000,
            padding: "16px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <strong style={{ fontSize: "13px", color: "#1d1d1f" }}>显示字段</strong>
            <div style={{ display: "flex", gap: "6px" }}>
              <button className="btn btn-sm btn-ghost" onClick={setAll} style={{ fontSize: "11px", padding: "2px 8px" }}>
                全选
              </button>
              <button className="btn btn-sm btn-ghost" onClick={clearAll} style={{ fontSize: "11px", padding: "2px 8px" }}>
                清空
              </button>
              <button className="btn btn-sm btn-ghost" onClick={clearFilter} style={{ fontSize: "11px", padding: "2px 8px" }}>
                清除过滤
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#1d1d1f", fontWeight: 500 }}>
              <input type="checkbox" checked={state.enabled} onChange={(e) => setEnabled(e.target.checked)} />
              启用过滤
            </label>
            <span style={{ fontSize: "12px", color: "#86868b" }}>{allFields.length === 0 ? "暂无字段" : `共 ${allFields.length} 个字段`}</span>
          </div>

          {allFields.map((field) => (
            <label
              key={field}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 10px",
                cursor: state.enabled ? "pointer" : "not-allowed",
                borderRadius: "6px",
                fontSize: "13px",
                opacity: state.enabled ? 1 : 0.5,
                color: "#1d1d1f",
                transition: "background 0.1s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f7")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <input
                type="checkbox"
                disabled={!state.enabled}
                checked={effectiveSelected.includes(field)}
                onChange={(e) => toggleField(field, e.target.checked)}
                style={{ marginRight: "10px" }}
              />
              <span>{field}</span>
            </label>
          ))}

          {!state.enabled && (
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#86868b", padding: "0 4px" }}>
              当前未启用过滤（显示全部字段）。勾选“启用过滤”后可选择需要展示的字段。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
