import { useEffect } from "react";

interface UseFloatingMenuDismissOptions {
  rootSelector?: string;
}

export function useFloatingMenuDismiss(
  isOpen: boolean,
  onDismiss: () => void,
  options?: UseFloatingMenuDismissOptions
) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const rootSelector = options?.rootSelector ?? ".floating-menu-root";

    const handlePointerDownCapture = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(rootSelector)) {
        return;
      }
      onDismiss();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("mousedown", handlePointerDownCapture, true);
    document.addEventListener("touchstart", handlePointerDownCapture, true);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownCapture, true);
      document.removeEventListener("touchstart", handlePointerDownCapture, true);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onDismiss, options?.rootSelector]);
}