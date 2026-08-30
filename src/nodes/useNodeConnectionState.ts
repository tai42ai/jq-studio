/**
 * @fileoverview Shared hook for detecting node connection state.
 *
 * Extracts edge-detection logic used by both ValueNode and FunctionCallNode
 * to determine whether a node is a child (item/field/root target), part of
 * an operator chain, or in the main flow.
 */

import { useMemo } from 'react';
import { useEdges } from '@xyflow/react';
import { JQHandleIdPrefix } from '../enums';

/**
 * Analyzes edges to determine the connection state of a node.
 *
 * @param nodeId - The node ID to analyze
 * @returns Connection state flags:
 *   - `isChildNode`: connected via item/field/root handle (no name, no bottom handle)
 *   - `hasTopConnection`: has a TOP target handle connection (in main flow)
 *   - `hasOperatorConnection`: has operator source handle connections
 *   - `isChainNode`: no TOP connection but has operator connections (operator chain operand)
 */
export function useNodeConnectionState(nodeId: string) {
  const edges = useEdges();

  const isChildNode = useMemo(() => {
    return edges.some(
      (e) =>
        e.target === nodeId &&
        (e.sourceHandle?.startsWith(`${JQHandleIdPrefix.Item}:`) ??
          e.sourceHandle?.startsWith(`${JQHandleIdPrefix.Field}:`) ??
          e.sourceHandle?.startsWith(`${JQHandleIdPrefix.Root}:`)),
    );
  }, [nodeId, edges]);

  const hasTopConnection = useMemo(() => {
    return edges.some(
      (e) => e.target === nodeId && e.targetHandle?.startsWith(JQHandleIdPrefix.Top),
    );
  }, [nodeId, edges]);

  const hasLeftOperatorConnection = useMemo(() => {
    return edges.some(
      (e) => e.source === nodeId && e.sourceHandle?.startsWith(JQHandleIdPrefix.OperatorLeft),
    );
  }, [nodeId, edges]);

  const hasRightOperatorConnection = useMemo(() => {
    return edges.some(
      (e) => e.source === nodeId && e.sourceHandle?.startsWith(JQHandleIdPrefix.OperatorRight),
    );
  }, [nodeId, edges]);

  const hasOperatorConnection = hasLeftOperatorConnection || hasRightOperatorConnection;

  const hasBottomConnection = useMemo(() => {
    return edges.some(
      (e) => e.source === nodeId && e.sourceHandle?.startsWith(JQHandleIdPrefix.Bottom),
    );
  }, [nodeId, edges]);

  // Only hide top handle when operator is to the LEFT (node is right operand)
  const isChainNode = !hasTopConnection && hasLeftOperatorConnection;

  return { isChildNode, hasTopConnection, hasOperatorConnection, hasBottomConnection, isChainNode };
}
