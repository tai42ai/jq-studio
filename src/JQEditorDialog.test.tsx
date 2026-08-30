/**
 * @fileoverview Covers the dialog's Save surfaces. Both the Save button and the
 * canvas's Cmd/Ctrl+S refuse a logic-less canvas through one shared banner —
 * never a silent disabled button, never two stacked alerts — and otherwise save
 * the expression the canvas produced.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JQEditorDialog } from './JQEditorDialog';
import { LOGIC_LESS_SAVE_MESSAGE } from './TransformerCanvas';

/** A chain of nothing but a comment: a Start anchor and a comment, no logic node. */
const COMMENTS_ONLY = '# note';

const renderDialog = (initialExpression: string) => {
  const onSave = vi.fn();
  render(
    <JQEditorDialog open initialExpression={initialExpression} onSave={onSave} onClose={vi.fn()} />,
  );
  return { onSave };
};

const saveButton = (): HTMLElement => screen.getByRole('button', { name: /Save/ });

const pressSaveShortcut = (): void => {
  fireEvent.keyDown(window, { key: 's', metaKey: true });
};

/** Resolves once the loaded expression has been laid out as canvas nodes. */
const canvasLoaded = async (): Promise<void> => {
  await waitFor(() => {
    expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(1);
  });
};

describe('JQEditorDialog save gate', () => {
  it('should refuse a logic-less canvas from the Save button and tell the user why', async () => {
    const { onSave } = renderDialog(COMMENTS_ONLY);

    await canvasLoaded();
    // The button stays clickable so the refusal is loud, not a silent disable.
    await waitFor(() => {
      expect(saveButton()).toBeEnabled();
    });
    fireEvent.click(saveButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(LOGIC_LESS_SAVE_MESSAGE);
  });

  it('should save a graph that converts from the Save button', async () => {
    const { onSave } = renderDialog('.a');

    await canvasLoaded();
    await waitFor(() => {
      expect(saveButton()).toBeEnabled();
    });
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith('.a');
  });

  it('should show only one refusal banner across Cmd+S then a Save click', async () => {
    renderDialog(COMMENTS_ONLY);

    await canvasLoaded();
    // Cmd/Ctrl+S surfaces the shared refusal banner...
    pressSaveShortcut();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(LOGIC_LESS_SAVE_MESSAGE);
    });
    // ...and clicking Save reuses it rather than stacking a second alert.
    fireEvent.click(saveButton());

    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

describe('JQEditorDialog shell', () => {
  it('mounts on the fullscreen Dialog primitive and hangs the scoping class on the content element', () => {
    render(
      <JQEditorDialog
        open
        initialExpression=".a"
        fieldLabel="Result"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // The scoping class rides on the Radix content element (so the editor's scoped
    // styles reach inside the portal), which is also the fullscreen dialog panel.
    const dialog = screen.getByRole('dialog', { name: 'Result — Editor' });
    expect(dialog).toHaveClass('jqp-dialog-fullscreen');
    expect(dialog).toHaveClass('jq-studio-root');
    expect(dialog).toHaveClass('jqs-jq-fullscreen');
  });

  it('closes through the primitives dialog on Escape', async () => {
    const onClose = vi.fn();
    render(<JQEditorDialog open initialExpression=".a" onSave={vi.fn()} onClose={onClose} />);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the input-shape context chip when a shape is provided', () => {
    render(
      <JQEditorDialog
        open
        initialExpression=".a"
        fieldLabel="Result"
        shape={{
          id: 'test:env',
          label: 'node envelope',
          blurb: 'The data a node receives.',
          keys: [{ name: 'result', gloss: 'the result so far' }],
          returns: 'an object',
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('in: node envelope')).toBeInTheDocument();
  });

  it('read-only mode drops the Save affordance and names itself a viewer', () => {
    render(
      <JQEditorDialog
        open
        initialExpression=".a"
        fieldLabel="Result"
        onSave={vi.fn()}
        onClose={vi.fn()}
        readOnly
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Result — Viewer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
  });
});

// The dirty guard, exercised against the REAL canvas — the case dirty.test.tsx
// cannot reach because it mocks the canvas away. Regression cover for the baseline
// bug: the canvas mounts empty and emits the `# Error: cannot convert empty graph`
// placeholder BEFORE the real graph loads; if the dialog pinned THAT as baseline,
// every freshly-opened valid expression read dirty and prompted a spurious
// discard-confirm on close. The baseline must be the graph's first REAL emission.
describe('JQEditorDialog dirty guard (real canvas)', () => {
  /** Deletes the loaded logic node to force a genuine, serialization-changing
   *  edit through the real canvas. */
  const deleteLogicNode = async (): Promise<void> => {
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

  it('closes a freshly-opened valid expression straight through — no spurious confirm', async () => {
    const onClose = vi.fn();
    render(<JQEditorDialog open initialExpression=".foo" onSave={vi.fn()} onClose={onClose} />);

    await canvasLoaded();
    // A pure round-trip is NOT an unsaved change: Escape must close straight
    // through, never raising the discard-confirm.
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });

  it('raises the discard-confirm on close once the graph is genuinely edited', async () => {
    const onClose = vi.fn();
    render(<JQEditorDialog open initialExpression=".foo" onSave={vi.fn()} onClose={onClose} />);

    await canvasLoaded();
    await deleteLogicNode();
    fireEvent.keyDown(document, { key: 'Escape' });

    // The real edit is guarded: the confirm appears and onClose is withheld.
    await screen.findByText('Discard unsaved changes?');
    expect(onClose).not.toHaveBeenCalled();
  });
});
