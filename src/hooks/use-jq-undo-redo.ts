/**
 * Canvas undo/redo snapshot stacks for the jq visual editor.
 *
 * jq-studio is a standalone package: it keeps its OWN undo/redo history rather
 * than reaching into the host flow editor's, so the two editors stay isolated
 * (the enclosing flow editor mutes its own shortcuts while a jq dialog is open —
 * see the editor-context open-gate). The mechanism is the generic snapshot-stack
 * idiom: call `takeSnapshot` BEFORE a mutating action; Ctrl/Cmd+Z undoes,
 * Ctrl/Cmd+Shift+Z or Ctrl+Y redoes, suppressed while focus is in a form control.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';

interface HistoryItem<TNodeData extends Record<string, unknown>> {
  nodes: Node<TNodeData>[];
  edges: Edge[];
}

interface UseJqUndoRedoOptions<TNodeData extends Record<string, unknown>> {
  nodes: Node<TNodeData>[];
  edges: Edge[];
  setNodes: (nodes: Node<TNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onChange?: () => void;
  maxHistorySize?: number;
  enabled?: boolean;
}

/** Whether the keystroke target is a form control that owns its own text/edit
 *  history — canvas undo/redo must not steal a keystroke aimed at it. Covers
 *  input (incl. checkbox/radio), textarea, select, and any contenteditable host. */
const isFormControlTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

/** A structural fingerprint of the graph that IGNORES ephemeral UI state
 *  (`selected`, `dragging`, measured sizes): only a node's id / type / position /
 *  data and an edge's id / endpoints / handles change the meaning worth undoing.
 *  Two snapshots with the same fingerprint represent the same edit state, so a
 *  pure selection or inspect click must not push a new history entry. */
const graphFingerprint = <TNodeData extends Record<string, unknown>>(
  nodes: Node<TNodeData>[],
  edges: Edge[],
): string =>
  JSON.stringify({
    n: nodes.map((n) => ({ i: n.id, t: n.type, x: n.position.x, y: n.position.y, d: n.data })),
    e: edges.map((e) => ({
      i: e.id,
      s: e.source,
      t: e.target,
      sh: e.sourceHandle ?? null,
      th: e.targetHandle ?? null,
    })),
  });

/**
 * Pure past/future snapshot stacks for canvas undo/redo. Call `takeSnapshot`
 * BEFORE a mutating action (drag start, connect, drop). Ctrl/Cmd+Z undoes,
 * Ctrl/Cmd+Shift+Z or Ctrl+Y redoes — suppressed while focus is in a form control.
 * `onChange` fires after an applied undo/redo so a consumer can react to the graph
 * swap (e.g. reseed an open edit panel from the post-undo node).
 */
export const useJqUndoRedo = <TNodeData extends Record<string, unknown>>({
  nodes,
  edges,
  setNodes,
  setEdges,
  onChange,
  maxHistorySize = 50,
  enabled = true,
}: UseJqUndoRedoOptions<TNodeData>) => {
  const [past, setPast] = useState<HistoryItem<TNodeData>[]>([]);
  const [future, setFuture] = useState<HistoryItem<TNodeData>[]>([]);

  const takeSnapshot = useCallback(() => {
    // Skip a no-op snapshot: if the graph is structurally unchanged from the top
    // of the stack (a pure selection / inspect click, or a redundant snapshot
    // call), pushing would both pollute history and needlessly clear redo. Leave
    // both stacks untouched in that case.
    const top = past.at(-1);
    if (top && graphFingerprint(top.nodes, top.edges) === graphFingerprint(nodes, edges)) {
      return;
    }
    setPast((prev) => [...prev, { nodes, edges }].slice(-maxHistorySize));
    setFuture([]);
  }, [past, nodes, edges, maxHistorySize]);

  const undo = useCallback(() => {
    const previousState = past.at(-1);
    if (!previousState) return;
    setPast(past.slice(0, past.length - 1));
    setFuture((prev) => [{ nodes, edges }, ...prev]);
    setNodes(previousState.nodes);
    setEdges(previousState.edges);
    onChange?.();
  }, [past, nodes, edges, setNodes, setEdges, onChange]);

  const redo = useCallback(() => {
    const nextState = future.at(0);
    if (!nextState) return;
    setFuture(future.slice(1));
    setPast((prev) => [...prev, { nodes, edges }]);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    onChange?.();
  }, [future, nodes, edges, setNodes, setEdges, onChange]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFormControlTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && /z/i.test(event.key)) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && /y/i.test(event.key)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, enabled]);

  return { takeSnapshot, canUndo: past.length > 0, canRedo: future.length > 0, undo, redo };
};
