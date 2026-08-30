/**
 * @fileoverview Layout orchestrator - coordinates all 7 phases of the layout algorithm.
 *
 * The new layout uses edge classification to distinguish vertical pipe chains
 * from horizontal branches, producing clean tree-structured layouts where:
 * - Pipe chains flow top-to-bottom
 * - Branches (conditions, try-catch, params, etc.) fan out to the right
 * - Operator operands are placed to the left and right
 */

import { type JQNode, type JQEdge } from '../../../../types';
import { type LayoutContext } from './types';
import { classifyEdges, computeFlowLayers, estimateNodeDimensions } from './phase1-graph-analysis';
import { buildAdjacency } from './phase2-vertical';
import { computeSubTreeSizes } from './phase3-horizontal';
import { positionAllNodes } from './phase4-centering';
import { postPositionAdjustments } from './phase5-special-groups';
import { resolveOverlaps } from './phase6-collision';
import { finalizePositions } from './phase7-finalize';

/**
 * Applies auto-layout algorithm to position all nodes.
 *
 * 7-phase pipeline:
 * 1. Edge classification + flow-only layering + dimension estimation
 * 2. Build adjacency data structures
 * 3. Compute sub-tree bounding boxes
 * 4. Recursive tree-walk positioning (THE CORE)
 * 5. Post-positioning adjustments (orphans, group recording)
 * 6. AABB overlap resolution
 * 7. Normalize to positive space with padding
 *
 * @param nodes - Array of nodes to position
 * @param edges - Array of edges connecting nodes
 */
export function applyAutoLayout(nodes: JQNode[], edges: JQEdge[]): void {
  if (nodes.length === 0) return;

  const layoutCtx: LayoutContext = {
    layers: new Map(),
    nodeDepths: new Map(),
    nodeDimensions: new Map(),
    classifiedEdges: [],
    flowEdges: [],
    branchEdgesBySource: new Map(),
    operatorEdgesByTarget: new Map(),
    operatorChainBySource: new Map(),
    flowParent: new Map(),
    flowChildren: new Map(),
    subTreeSizes: new Map(),
    branchGroups: new Map(),
    functionGroups: new Map(),
    nodePositions: new Map(),
    positionedNodes: new Set(),
    startNodeId: null,
  };

  // Phase 1: Classify edges, compute flow layers, estimate dimensions
  classifyEdges(edges, layoutCtx);
  computeFlowLayers(nodes, layoutCtx);
  estimateNodeDimensions(nodes, layoutCtx);

  // Phase 2: Build adjacency structures
  buildAdjacency(layoutCtx);

  // Phase 3: Compute sub-tree bounding boxes
  computeSubTreeSizes(nodes, layoutCtx);

  // Phase 4: Recursive tree-walk positioning (THE CORE)
  positionAllNodes(layoutCtx);

  // Phase 5: Post-positioning adjustments
  postPositionAdjustments(nodes, edges, layoutCtx);

  // Phase 6: AABB overlap resolution
  resolveOverlaps(nodes, layoutCtx);

  // Phase 7: Normalize to positive space
  finalizePositions(nodes, layoutCtx);
}
