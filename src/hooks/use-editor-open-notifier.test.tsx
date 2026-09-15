/**
 * The open-state notify a host uses to MUTE its global keyboard shortcuts
 * (window-level keydown for undo/redo/save/delete) while the editor is open —
 * a keydown bubbles to `window` even from the editor's focus-trapped modal, so
 * the host must know when to stand down. Every transition must be reported;
 * these drive the REAL dialog through `JqField` so each close route is exercised
 * end-to-end.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// The Test panel preloads the jq WASM runner on open; jsdom has no WASM fetch, so
// stub the runner (the transitions under test need no evaluation).
vi.mock('./useJqRunner', () => ({
  useJqRunner: () => ({
    result: null,
    isRunning: false,
    run: vi.fn(),
    clear: vi.fn(),
    preload: vi.fn(),
  }),
}));

import { JqField } from '../JqField';

describe('onEditorOpenChange (global-shortcut muting)', () => {
  const openEditor = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /visual editor/i }));
  };

  /** Resolves once the loaded expression has been laid out as canvas nodes and
   *  the Save action is live — the point from which a real Save/close acts. */
  const editorReady = async (): Promise<void> => {
    await waitFor(() => {
      expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled();
    });
  };

  /** Drives a GENUINE, serialization-changing edit through the real canvas:
   *  selects the loaded logic node and deletes it, so the editor is honestly
   *  dirty and a close routes through the discard-confirm (not a straight
   *  close). This keeps the close-route tests honest: a freshly-opened valid
   *  expression is not dirty. */
  const makeDirtyEdit = async (): Promise<void> => {
    const before = document.querySelectorAll('.react-flow__node').length;
    const logicNode = Array.from(document.querySelectorAll('.react-flow__node')).find(
      (node) => !node.className.includes('jqStart'),
    );
    if (!logicNode) throw new Error('expected a non-Start logic node to delete');
    const pane = document.querySelector('.react-flow');
    if (!pane) throw new Error('expected the react-flow pane');
    fireEvent.click(logicNode);
    fireEvent.keyDown(pane, { key: 'Backspace' });
    await waitFor(() => {
      expect(document.querySelectorAll('.react-flow__node').length).toBeLessThan(before);
    });
  };

  it('reports true when the door button opens the editor', () => {
    const onEditorOpenChange = vi.fn();
    render(
      <JqField
        label="Transform"
        value=".a"
        onChange={vi.fn()}
        onEditorOpenChange={onEditorOpenChange}
      />,
    );

    expect(onEditorOpenChange).not.toHaveBeenCalled();
    openEditor();
    expect(onEditorOpenChange).toHaveBeenCalledTimes(1);
    expect(onEditorOpenChange).toHaveBeenLastCalledWith(true);
  });

  it('reports false when a Save closes the editor', async () => {
    const onEditorOpenChange = vi.fn();
    const onChange = vi.fn();
    render(
      <JqField
        label="Transform"
        value=".a"
        onChange={onChange}
        onEditorOpenChange={onEditorOpenChange}
      />,
    );

    openEditor();
    await editorReady();
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('.a');
    });
    // Every transition, in order: open then the save-close.
    expect(onEditorOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('reports false only after the discard-confirm is accepted on an Escape close', async () => {
    const onEditorOpenChange = vi.fn();
    render(
      <JqField
        label="Transform"
        value=".foo"
        onChange={vi.fn()}
        onEditorOpenChange={onEditorOpenChange}
      />,
    );

    openEditor();
    await editorReady();
    await makeDirtyEdit();
    // A genuinely edited editor guards the close: Escape raises the discard-
    // confirm instead of closing, so no false has fired yet — still open.
    fireEvent.keyDown(document, { key: 'Escape' });
    await screen.findByText('Discard unsaved changes?');
    expect(onEditorOpenChange.mock.calls).toEqual([[true]]);

    // Accepting the discard is the actual close → the false transition fires.
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => {
      expect(onEditorOpenChange.mock.calls).toEqual([[true], [false]]);
    });
  });

  it('reports false when Cancel closes an edited editor via the discard-confirm', async () => {
    const onEditorOpenChange = vi.fn();
    render(
      <JqField
        label="Transform"
        value=".foo"
        onChange={vi.fn()}
        onEditorOpenChange={onEditorOpenChange}
      />,
    );

    openEditor();
    await editorReady();
    await makeDirtyEdit();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Discard/ }));

    await waitFor(() => {
      expect(onEditorOpenChange.mock.calls).toEqual([[true], [false]]);
    });
  });

  it('does not fire on mount and fires exactly once per real transition under StrictMode', () => {
    const onEditorOpenChange = vi.fn();
    render(
      <StrictMode>
        <JqField
          label="Transform"
          value=".a"
          onChange={vi.fn()}
          onEditorOpenChange={onEditorOpenChange}
        />
      </StrictMode>,
    );

    // StrictMode double-invokes mount effects; the net-committed-transition
    // guard means the mount yields no spurious call.
    expect(onEditorOpenChange).not.toHaveBeenCalled();
    openEditor();
    expect(onEditorOpenChange.mock.calls).toEqual([[true]]);
  });

  it('fires false exactly once when the field unmounts while the editor is open', () => {
    const onEditorOpenChange = vi.fn();
    const { unmount } = render(
      <JqField
        label="Transform"
        value=".a"
        onChange={vi.fn()}
        onEditorOpenChange={onEditorOpenChange}
      />,
    );

    openEditor();
    expect(onEditorOpenChange.mock.calls).toEqual([[true]]);

    // Tearing the field down while open is a close for the muting contract —
    // fired once by the unmount cleanup, never duplicated by the transition
    // effect (which has no such cleanup).
    unmount();
    expect(onEditorOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});
