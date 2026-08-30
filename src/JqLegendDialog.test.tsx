/**
 * @fileoverview The canvas Legend dialog portals to `document.body` via the
 * primitives `Dialog`, so it must carry the library scoping class on its content element —
 * without it every scoped `jqs-jq-*` rule and theme var is dropped and the
 * legend renders unstyled. This pins that the portaled content hangs the root
 * class (matching JqTestPanel / JQEditorDialog).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JqLegendDialog } from './JqLegendDialog';

describe('JqLegendDialog', () => {
  it('hangs the library scoping class on the portaled content so scoped styles reach inside', () => {
    render(<JqLegendDialog />);

    // The legend opens from the toolbar button.
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));

    // The scoping class rides the Radix content element (the dialog panel), so the
    // legend's scoped styles apply inside the portal.
    const dialog = screen.getByRole('dialog', { name: 'Legend' });
    expect(dialog).toHaveClass('jq-studio-root');
    // The legend body is present inside that scoped content.
    expect(screen.getByText('Node kinds')).toBeInTheDocument();
    expect(screen.getByText('Wires')).toBeInTheDocument();
  });

  it('documents the new port role labels in the wire notation', () => {
    render(<JqLegendDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));

    // A wire-notation row explains the glanceable if / then / else / try / catch
    // / body role labels the branching cards now carry.
    expect(screen.getByText('Role label')).toBeInTheDocument();
    expect(
      screen.getByText(/if \/ then \/ else.*try \/ catch.*body.*chip at its start/s),
    ).toBeInTheDocument();

    // ...and the order-/key-bearing slot labels (operator operands, call args,
    // object keys, array indices).
    expect(screen.getByText('Slot label')).toBeInTheDocument();
    expect(
      screen.getByText(/a \/ b operands.*parameter names.*keys.*indices/s),
    ).toBeInTheDocument();
  });
});
