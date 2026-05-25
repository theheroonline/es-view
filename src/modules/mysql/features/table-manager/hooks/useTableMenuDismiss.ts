import { useFloatingMenuDismiss } from "../../../../../hooks/useFloatingMenuDismiss";

interface UseTableMenuDismissProps {
  rowMenuOpen: boolean;
  treeMenuOpen: boolean;
  columnHeaderMenuOpen: boolean;
  columnMenuOpen: boolean;
  closeRowMenu: () => void;
  closeTreeMenu: () => void;
  closeColumnHeaderMenu: () => void;
  closeColumnMenu: () => void;
}

export function useTableMenuDismiss({
  rowMenuOpen,
  treeMenuOpen,
  columnHeaderMenuOpen,
  columnMenuOpen,
  closeRowMenu,
  closeTreeMenu,
  closeColumnHeaderMenu,
  closeColumnMenu,
}: UseTableMenuDismissProps) {
  useFloatingMenuDismiss(
    rowMenuOpen,
    closeRowMenu,
    { rootSelector: ".context-menu-panel" }
  );

  useFloatingMenuDismiss(
    treeMenuOpen || columnHeaderMenuOpen,
    () => {
      closeTreeMenu();
      closeColumnHeaderMenu();
    },
    { rootSelector: ".context-menu-panel" }
  );

  useFloatingMenuDismiss(
    columnMenuOpen,
    closeColumnMenu,
    { rootSelector: ".tm-toolbar-actions, .tm-column-menu-dropdown, .tm-column-menu-body" }
  );
}
