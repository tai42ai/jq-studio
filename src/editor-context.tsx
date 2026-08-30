/**
 * Open-gate for the visual jq editor dialog.
 *
 * A single boolean the surrounding flow editor reads to mute its own global
 * keyboard shortcuts while a jq editor dialog is open: the editor's undo/redo
 * shortcuts are disabled (the dialog owns its own snapshot history), and the
 * dialog's own Cmd/Ctrl+S saves the expression rather than bubbling to the
 * flow. The dialog flips it on open and off on close.
 */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface JQEditorContextValue {
  isJQEditorOpen: boolean;
  setJQEditorOpen: (open: boolean) => void;
}

const JQEditorContext = createContext<JQEditorContextValue>({
  isJQEditorOpen: false,
  setJQEditorOpen: () => undefined,
});

export const useJQEditorState = (): JQEditorContextValue => useContext(JQEditorContext);

export const JQEditorProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const [isJQEditorOpen, setJQEditorOpen] = useState(false);
  return (
    <JQEditorContext.Provider value={{ isJQEditorOpen, setJQEditorOpen }}>
      {children}
    </JQEditorContext.Provider>
  );
};
