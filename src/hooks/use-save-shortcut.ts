/**
 * Cmd/Ctrl+S saves the current expression. The save is REFUSED loudly, never
 * silently: while the parse-failure fallback is up it does nothing, a logic-less
 * canvas routes to `onLogicLessSave` (which surfaces the refusal), and any graph
 * error that holds the Save button disabled also blocks the shortcut.
 */
import { useEffect } from 'react';

interface SaveShortcutParams {
  onSave: ((expression: string) => void) | undefined;
  expression: string;
  hasErrors: boolean;
  hasLogicNode: boolean;
  onLogicLessSave: (() => void) | undefined;
  parseFailed: boolean;
  readOnly: boolean | undefined;
}

export const useSaveShortcut = ({
  onSave,
  expression,
  hasErrors,
  hasLogicNode,
  onLogicLessSave,
  parseFailed,
  readOnly,
}: SaveShortcutParams): void => {
  useEffect(() => {
    if (!onSave || readOnly) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        if (parseFailed) return;
        if (!hasLogicNode) {
          onLogicLessSave?.();
          return;
        }
        if (hasErrors) return;
        onSave(expression);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave, expression, hasErrors, hasLogicNode, onLogicLessSave, parseFailed, readOnly]);
};
