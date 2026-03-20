import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualTable } from "../../../hooks/useVirtualTable";

interface DataBrowserJsonViewProps {
  rows: any[];
}

/**
 * ES DataBrowser JSON 视图组件 - 虚拟滚动优化
 *
 * 优化：
 * - 虚拟滚动渲染，支持 1000+ 行无卡顿
 * - 延迟 JSON.stringify 计算（仅渲染可见行）
 */
export function DataBrowserJsonView({ rows }: DataBrowserJsonViewProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { virtualRows } = useVirtualTable({
    rows,
    rowHeight: 36,
    overscan: 15,
    scrollElement: () => scrollContainerRef.current,
  });

  return (
    <>
      <div
        style={{
          padding: "12px 16px",
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
          marginBottom: "12px",
          fontSize: "13px",
          color: "#1e40af",
        }}
      >
        💡 {t("dataBrowser.jsonViewTip")}
      </div>
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}
        className="table-wrapper"
      >
        <table className="table" style={{ borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "white" }}>
            <tr>
              <th style={{ width: "120px" }}>{t("dataBrowser.id")}</th>
              <th>{t("dataBrowser.sourceJson")}</th>
            </tr>
          </thead>
          <tbody>
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr key={row._id} style={{ height: "36px" }}>
                  <td>{row._id}</td>
                  <td>
                    <pre style={{ margin: 0, fontSize: "12px" }}>
                      {JSON.stringify(row._source, null, 2)}
                    </pre>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
