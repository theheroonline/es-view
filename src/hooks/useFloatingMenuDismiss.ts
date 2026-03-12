import { useEffect } from "react";

export function useFloatingMenuDismiss(isOpen: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.addEventListener("click", onDismiss);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("scroll", onDismiss, true);

    return () => {
      window.removeEventListener("click", onDismiss);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("scroll", onDismiss, true);
    };
  }, [isOpen, onDismiss]);
}