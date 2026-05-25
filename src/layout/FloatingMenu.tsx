import type { ReactNode } from "react";

interface FloatingMenuProps {
  x: number;
  y: number;
  minWidth: number;
  children: ReactNode;
}

export function FloatingMenu({ x, y, minWidth, children }: FloatingMenuProps) {
  return (
    <div
      className="floating-menu-root"
      style={{
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 1200,
        minWidth: `${minWidth}px`,
        background: "#fff",
        border: "1px solid #d1d1d6",
        borderRadius: "8px",
        boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
        padding: "4px"
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function FloatingMenuDivider() {
  return <div style={{ height: "1px", background: "#e5e5ea", margin: "4px 0" }} />;
}