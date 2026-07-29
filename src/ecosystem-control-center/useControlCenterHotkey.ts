// VENDORED from @ecosystem/control-center — do not edit here.
import { useEffect } from 'react';

export function useControlCenterHotkey(
  onToggle: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        onToggle();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onToggle]);
}
