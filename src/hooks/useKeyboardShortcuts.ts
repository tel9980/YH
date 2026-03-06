import { useEffect } from "react";

type ShortcutAction = () => void;

interface ShortcutMap {
  [key: string]: ShortcutAction;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutMap) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl/Cmd combinations
      const isCmd = event.ctrlKey || event.metaKey;
      
      let key = event.key.toLowerCase();
      if (isCmd) key = `ctrl+${key}`;
      if (event.shiftKey) key = `shift+${key}`;
      if (event.altKey) key = `alt+${key}`;

      if (shortcuts[key]) {
        event.preventDefault();
        shortcuts[key]();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
};
