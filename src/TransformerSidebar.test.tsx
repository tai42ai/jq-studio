/**
 * @fileoverview Covers the palette's click-to-add path: a palette item drops a
 * node at the viewport centre on click (and thus on keyboard Enter/Space), not
 * only via drag — so adding a node never requires a pointer drag.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransformerEditor } from './transformer-editor';

const nodeCount = (): number => document.querySelectorAll('.react-flow__node').length;

describe('palette click-to-add', () => {
  it('adds a node on a plain click of a palette item', async () => {
    render(<TransformerEditor initialExpression=".a" onChange={vi.fn()} />);

    // Wait for the loaded graph AND the flow instance (onInit) to be ready.
    await waitFor(() => {
      expect(nodeCount()).toBeGreaterThan(0);
    });
    const before = nodeCount();

    // The Value palette item — a plain click, no drag.
    fireEvent.click(screen.getByRole('button', { name: /^Value/ }));

    await waitFor(() => {
      expect(nodeCount()).toBe(before + 1);
    });
  });
});
