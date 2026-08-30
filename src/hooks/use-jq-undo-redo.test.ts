/**
 * @fileoverview Covers undo/redo history hygiene: a snapshot whose graph is
 * structurally identical to the top of the stack (a pure selection / inspect —
 * only the ephemeral `selected` flag changed) is a no-op, so inspecting nodes
 * neither pollutes history nor clears redo. A real structural change still pushes.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { useJqUndoRedo } from './use-jq-undo-redo';

type Data = Record<string, unknown>;

const node = (id: string, data: Data, selected = false): Node<Data> => ({
  id,
  type: 'jqValue',
  position: { x: 0, y: 0 },
  data,
  selected,
});

const opts = (nodes: Node<Data>[], edges: Edge[] = []) => ({
  nodes,
  edges,
  setNodes: vi.fn(),
  setEdges: vi.fn(),
});

describe('useJqUndoRedo history hygiene', () => {
  it('pushes a snapshot for a real structural change', () => {
    const { result } = renderHook(() => useJqUndoRedo(opts([node('a', { value: '1' })])));
    expect(result.current.canUndo).toBe(false);
    act(() => {
      result.current.takeSnapshot();
    });
    expect(result.current.canUndo).toBe(true);
  });

  it('skips a selection-only snapshot (no history entry, no redo clear)', () => {
    const base = [node('a', { value: '1' }, false)];
    const { result, rerender } = renderHook((props) => useJqUndoRedo(props), {
      initialProps: opts(base),
    });

    // One real snapshot on the stack.
    act(() => {
      result.current.takeSnapshot();
    });

    // Re-render with ONLY the `selected` flag toggled — a pure inspect click.
    rerender(opts([node('a', { value: '1' }, true)]));
    act(() => {
      result.current.takeSnapshot();
    });

    // If the selection had polluted history there would be TWO entries and one
    // undo would leave `canUndo` true; the skip means a single undo empties it.
    act(() => {
      result.current.undo();
    });
    expect(result.current.canUndo).toBe(false);
  });

  it('still pushes when a node’s data actually changes', () => {
    const { result, rerender } = renderHook((props) => useJqUndoRedo(props), {
      initialProps: opts([node('a', { value: '1' })]),
    });
    act(() => {
      result.current.takeSnapshot();
    });
    rerender(opts([node('a', { value: '2' })])); // real edit
    act(() => {
      result.current.takeSnapshot();
    });
    // Two distinct entries: undo twice before the stack empties.
    act(() => {
      result.current.undo();
    });
    expect(result.current.canUndo).toBe(true);
  });
});
