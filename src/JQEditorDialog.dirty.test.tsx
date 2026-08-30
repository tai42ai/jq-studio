/**
 * @fileoverview Covers the unsaved-changes guard on close. Escape / overlay /
 * Cancel all route through one dirty check: an edited expression prompts a
 * confirm before it is dropped; a clean editor (or a read-only viewer) closes
 * straight through. The dirty baseline is the editor's FIRST emitted expression
 * (the faithful round-trip of the loaded graph), so a pure reformat never reads
 * as an unsaved change. The real TransformerEditor is mocked here so the test
 * drives `onChange` / `onRequestClose` deterministically without a laid-out canvas.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./transformer-editor', () => ({
  TransformerEditor: ({
    onChange,
    onRequestClose,
  }: {
    onChange?: (expr: string) => void;
    onRequestClose?: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onChange?.('BASELINE')}>
        seed
      </button>
      <button type="button" onClick={() => onChange?.('EDITED')}>
        edit
      </button>
      <button type="button" onClick={() => onRequestClose?.()}>
        editor-close
      </button>
    </div>
  ),
}));

import { JQEditorDialog } from './JQEditorDialog';

const cancelButton = () => screen.getByRole('button', { name: /Cancel|Close/ });

describe('JQEditorDialog unsaved-changes guard', () => {
  it('prompts before closing when the expression has been edited', () => {
    const onClose = vi.fn();
    render(<JQEditorDialog open initialExpression=".a" onSave={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByText('seed')); // baseline round-trip
    fireEvent.click(screen.getByText('edit')); // a real edit → dirty
    fireEvent.click(cancelButton());

    // The close is intercepted by the confirm — not dropped.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes straight through when nothing was edited past the round-trip baseline', () => {
    const onClose = vi.fn();
    render(<JQEditorDialog open initialExpression=".a" onSave={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByText('seed')); // baseline only, no edit
    fireEvent.click(cancelButton());

    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a read-only viewer never guards (there are no edits to lose)', () => {
    const onClose = vi.fn();
    render(
      <JQEditorDialog open initialExpression=".a" onSave={vi.fn()} onClose={onClose} readOnly />,
    );

    fireEvent.click(cancelButton());

    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the editor’s own close affordance is guarded too', () => {
    const onClose = vi.fn();
    render(<JQEditorDialog open initialExpression=".a" onSave={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByText('editor-close'));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
  });
});
