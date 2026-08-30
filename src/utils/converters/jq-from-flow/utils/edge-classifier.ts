/**
 * @fileoverview Edge classification utilities for determining connection types.
 */

import { type JQEdge } from '../../../../types';
import { JQHandleIdPrefix } from '../../../../enums';
import { type EdgeClassification } from '../types';
import { SIDE_HANDLE_PREFIXES } from '../constants';

/**
 * Classifies an edge to determine its connection type.
 *
 * Side handle connections result in inline expressions (no variable creation).
 * Bottom handle connections create new steps in the expression chain (may create variables).
 *
 * @param edge - The edge to classify
 * @returns Classification result with connection type information
 *
 * @example
 * const edge = { source: 'func1', target: 'value1', sourceHandle: `${JQHandleIdPrefix.Param}:0`, targetHandle: JQHandleIdPrefix.Top };
 * classifyEdge(edge); // Returns: { isSideHandle: true, isBottomHandle: false, handleType: JQHandleIdPrefix.Param }
 *
 * @example
 * const edge = { source: 'func1', target: 'func2', sourceHandle: JQHandleIdPrefix.Bottom, targetHandle: JQHandleIdPrefix.Top };
 * classifyEdge(edge); // Returns: { isSideHandle: false, isBottomHandle: true, handleType: 'bottom' }
 */
export function classifyEdge(edge: JQEdge): EdgeClassification {
  const sourceHandle = edge.sourceHandle ?? '';

  // Check if this is a side handle connection
  const isSidePrefix = SIDE_HANDLE_PREFIXES.some((prefix) => sourceHandle.startsWith(prefix));
  const isSideHandle = isSidePrefix || sourceHandle === (JQHandleIdPrefix.Else as string);

  // Check if this is a bottom handle connection
  const isBottomHandle =
    sourceHandle.startsWith(JQHandleIdPrefix.Bottom) ||
    sourceHandle === (JQHandleIdPrefix.Flow as string);

  // Determine handle type
  let handleType: string | null = null;
  if (isSideHandle) {
    const colonIndex = sourceHandle.indexOf(':');
    handleType = colonIndex >= 0 ? sourceHandle.substring(0, colonIndex) : sourceHandle;
  } else if (isBottomHandle) {
    handleType = 'bottom';
  }

  return { isSideHandle, isBottomHandle, handleType };
}

/**
 * Builds efficient lookup maps for edges to enable O(1) access during traversal.
 *
 * @param edges - Array of all edges in the graph
 * @returns Two maps: edges by target and edges by source
 */
export function buildEdgeMaps(edges: JQEdge[]): {
  edgesByTarget: Map<string, JQEdge[]>;
  edgesBySource: Map<string, JQEdge[]>;
} {
  const edgesByTarget = new Map<string, JQEdge[]>();
  const edgesBySource = new Map<string, JQEdge[]>();

  for (const edge of edges) {
    // Add to target map
    let targetBucket = edgesByTarget.get(edge.target);
    if (!targetBucket) {
      targetBucket = [];
      edgesByTarget.set(edge.target, targetBucket);
    }
    targetBucket.push(edge);

    // Add to source map
    let sourceBucket = edgesBySource.get(edge.source);
    if (!sourceBucket) {
      sourceBucket = [];
      edgesBySource.set(edge.source, sourceBucket);
    }
    sourceBucket.push(edge);
  }

  return { edgesByTarget, edgesBySource };
}
