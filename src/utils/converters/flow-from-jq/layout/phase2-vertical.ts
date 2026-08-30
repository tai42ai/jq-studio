/**
 * @fileoverview Phase 2: Build adjacency data structures.
 *
 * Builds fast-lookup maps for flow parent/child relationships
 * and identifies the Start node for use by later phases.
 */

import { type LayoutContext } from './types';

/**
 * Phase 2: Builds adjacency data structures from flow edges.
 *
 * Creates flowParent and flowChildren maps so Phase 4 can walk
 * the flow chain efficiently.
 */
export function buildAdjacency(layoutCtx: LayoutContext): void {
  for (const edge of layoutCtx.flowEdges) {
    // flowChildren: first child only (pipe chains are linear)
    if (!layoutCtx.flowChildren.has(edge.source)) {
      layoutCtx.flowChildren.set(edge.source, edge.target);
    }

    // flowParent: child → parent
    layoutCtx.flowParent.set(edge.target, edge.source);
  }
}
