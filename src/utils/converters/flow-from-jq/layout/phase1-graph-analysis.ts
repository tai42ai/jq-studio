/**
 * @fileoverview Phase 1: Edge classification, flow-only layering, and dimension estimation.
 *
 * This phase:
 * 1. Classifies every edge as flow, start-flow, branch, or operator
 * 2. Computes topological layers using ONLY flow edges (BFS from Start)
 * 3. Estimates visual dimensions (width + height) for every node
 */

import { type JQNode, type JQEdge } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix, ValueType } from '../../../../enums';
import { type LayoutContext, type EdgeKind } from './types';
import { LAYOUT_CONFIG } from '../constants';

/**
 * Classifies an edge by inspecting its source and target handle IDs.
 */
function classifyEdge(edge: JQEdge): EdgeKind {
  const src = edge.sourceHandle ?? '';
  const tgt = edge.targetHandle ?? '';

  // Flow edges: bottom→top pipe connections
  if (src.startsWith(JQHandleIdPrefix.Bottom)) {
    return 'flow';
  }

  // Start node's flow handle → first node in main chain
  if (src.startsWith(JQHandleIdPrefix.Flow)) {
    return 'start-flow';
  }

  // Operator edges: anything targeting operator-left or operator-right
  if (
    tgt.startsWith(JQHandleIdPrefix.OperatorLeft) ||
    tgt.startsWith(JQHandleIdPrefix.OperatorRight)
  ) {
    return 'operator';
  }

  // Everything else is a branch edge
  return 'branch';
}

/**
 * Phase 1a: Classifies all edges and populates lookup structures.
 */
export function classifyEdges(edges: JQEdge[], layoutCtx: LayoutContext): void {
  for (const edge of edges) {
    const kind = classifyEdge(edge);
    layoutCtx.classifiedEdges.push({ edge, kind });

    if (kind === 'flow' || kind === 'start-flow') {
      layoutCtx.flowEdges.push(edge);
    } else if (kind === 'branch') {
      let branchBucket = layoutCtx.branchEdgesBySource.get(edge.source);
      if (!branchBucket) {
        branchBucket = [];
        layoutCtx.branchEdgesBySource.set(edge.source, branchBucket);
      }
      branchBucket.push(edge);
    } else {
      let entry = layoutCtx.operatorEdgesByTarget.get(edge.target);
      if (!entry) {
        entry = {};
        layoutCtx.operatorEdgesByTarget.set(edge.target, entry);
      }
      const targetHandle = edge.targetHandle ?? '';
      if (targetHandle.startsWith(JQHandleIdPrefix.OperatorLeft)) {
        entry.left = edge;
      } else {
        entry.right = edge;
      }
    }
  }

  // Build reverse lookup: left operand → operator node
  for (const [operatorId, entry] of layoutCtx.operatorEdgesByTarget) {
    if (entry.left) {
      layoutCtx.operatorChainBySource.set(entry.left.source, operatorId);
    }
  }
}

/**
 * Phase 1b: Computes topological layers using ONLY flow edges.
 *
 * BFS starts from the Start node and follows flow + start-flow edges.
 * Nodes not reachable via flow edges are NOT assigned layers.
 */
export function computeFlowLayers(nodes: JQNode[], layoutCtx: LayoutContext): void {
  const startNode = nodes.find((n) => n.data.type === JQNodeType.Start);
  if (!startNode) return;
  layoutCtx.startNodeId = startNode.id;

  // Build flow-only adjacency
  const flowAdj = new Map<string, string[]>();
  for (const node of nodes) {
    flowAdj.set(node.id, []);
  }
  for (const edge of layoutCtx.flowEdges) {
    flowAdj.get(edge.source)?.push(edge.target);
  }

  // BFS from Start
  const queue: string[] = [startNode.id];
  layoutCtx.nodeDepths.set(startNode.id, 0);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const currentDepth = layoutCtx.nodeDepths.get(current) ?? 0;

    let layerBucket = layoutCtx.layers.get(currentDepth);
    if (!layerBucket) {
      layerBucket = [];
      layoutCtx.layers.set(currentDepth, layerBucket);
    }
    layerBucket.push(current);

    for (const child of flowAdj.get(current) ?? []) {
      const newDepth = currentDepth + 1;
      const existingDepth = layoutCtx.nodeDepths.get(child);

      if (existingDepth === undefined || newDepth > existingDepth) {
        layoutCtx.nodeDepths.set(child, newDepth);
        queue.push(child);
      }
    }
  }
}

/**
 * Phase 1c: Estimates visual dimensions (width and height) for every node.
 */
export function estimateNodeDimensions(nodes: JQNode[], layoutCtx: LayoutContext): void {
  for (const node of nodes) {
    const width = LAYOUT_CONFIG.NODE_BASE_WIDTH;
    let height = LAYOUT_CONFIG.NODE_BASE_HEIGHT;

    switch (node.data.type) {
      case JQNodeType.Start:
        height = 110;
        break;

      case JQNodeType.Value: {
        const vt = (node.data as { valueType?: string }).valueType;
        if (vt === ValueType.Array) {
          const items = (node.data as { items?: unknown[] }).items ?? [];
          height = 120 + items.length * 28;
        } else if (vt === ValueType.Object) {
          const fields = (node.data as { fields?: unknown[] }).fields ?? [];
          height = 120 + fields.length * 32;
        } else {
          height = 100;
        }
        break;
      }

      case JQNodeType.FunctionCall:
        height = 140;
        break;

      case JQNodeType.Operator:
        height = 100;
        break;

      case JQNodeType.Condition: {
        const branches = (node.data as { branches?: unknown[] }).branches ?? [];
        height = 170 + Math.max(0, branches.length - 1) * 60;
        break;
      }

      case JQNodeType.TryCatch:
        height = 130;
        break;

      case JQNodeType.FunctionDecl: {
        const params = (node.data as { parameters?: string[] }).parameters ?? [];
        height = 160 + params.length * 30;
        break;
      }
    }

    layoutCtx.nodeDimensions.set(node.id, { width, height });
  }
}
