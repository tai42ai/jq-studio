/**
 * @fileoverview Phase 5: Post-positioning adjustments.
 *
 * Records branch groups and function groups on the layout context,
 * and positions any orphan nodes that were not reached by the Phase 4 tree-walk.
 */

import { type JQNode, type JQEdge } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../../enums';
import { type LayoutContext } from './types';
import { LAYOUT_CONFIG } from '../constants';

/**
 * Phase 5: Post-positioning adjustments.
 *
 * - Records branchGroups and functionGroups for external consumers
 * - Positions any orphan nodes that were missed by Phase 4
 */
export function postPositionAdjustments(
  nodes: JQNode[],
  edges: JQEdge[],
  layoutCtx: LayoutContext,
): void {
  const edgesBySource = new Map<string, JQEdge[]>();
  for (const edge of edges) {
    let bucket = edgesBySource.get(edge.source);
    if (!bucket) {
      bucket = [];
      edgesBySource.set(edge.source, bucket);
    }
    bucket.push(edge);
  }

  // Record branch groups (Condition and TryCatch nodes → their branch targets)
  for (const node of nodes) {
    if (node.data.type === JQNodeType.Condition || node.data.type === JQNodeType.TryCatch) {
      const outgoing = edgesBySource.get(node.id) ?? [];
      const branchTargets: string[] = [];
      for (const edge of outgoing) {
        const handle = edge.sourceHandle ?? '';
        if (
          handle.startsWith(JQHandleIdPrefix.Then) ||
          handle.startsWith(JQHandleIdPrefix.Else) ||
          handle.startsWith(JQHandleIdPrefix.Try) ||
          handle.startsWith(JQHandleIdPrefix.Catch)
        ) {
          branchTargets.push(edge.target);
        }
      }
      if (branchTargets.length > 0) {
        layoutCtx.branchGroups.set(node.id, branchTargets);
      }
    }

    // Record function groups (FunctionDecl → logic sub-graph)
    if (node.data.type === JQNodeType.FunctionDecl) {
      const outgoing = edgesBySource.get(node.id) ?? [];
      const logicEdge = outgoing.find((e) =>
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.Logic),
      );
      if (logicEdge) {
        const logicNodes = collectConnectedNodes(logicEdge.target, edgesBySource);
        layoutCtx.functionGroups.set(node.id, logicNodes);
      }
    }
  }

  // Position any orphan nodes not reached by Phase 4
  let orphanY = LAYOUT_CONFIG.START_Y;
  for (const pos of layoutCtx.nodePositions.values()) {
    orphanY = Math.max(orphanY, pos.y);
  }
  orphanY += LAYOUT_CONFIG.LAYER_SPACING + LAYOUT_CONFIG.NODE_BASE_HEIGHT;

  let orphanX = LAYOUT_CONFIG.PADDING;
  for (const node of nodes) {
    if (!layoutCtx.positionedNodes.has(node.id)) {
      layoutCtx.nodePositions.set(node.id, { x: orphanX, y: orphanY });
      layoutCtx.positionedNodes.add(node.id);
      orphanX += LAYOUT_CONFIG.NODE_BASE_WIDTH + LAYOUT_CONFIG.NODE_MIN_SPACING;
    }
  }
}

/**
 * Collects all nodes reachable from a starting node via outgoing edges.
 */
function collectConnectedNodes(
  startNodeId: string,
  edgesBySource: Map<string, JQEdge[]>,
): string[] {
  const collected = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId === undefined) continue;
    if (collected.has(currentId)) continue;
    collected.add(currentId);

    const outgoing = edgesBySource.get(currentId) ?? [];
    for (const edge of outgoing) {
      if (!collected.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  return Array.from(collected);
}
