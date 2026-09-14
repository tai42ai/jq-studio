/**
 * @fileoverview Phase 6: AABB-based overlap resolution.
 *
 * Uses axis-aligned bounding box (rectangle) overlap detection instead of
 * circular distance checks. Much more accurate since nodes are rectangles.
 * Overlaps should be rare after Phase 4's tree-walk positioning.
 */

import { type JQNode } from '../../../../types';
import { type LayoutContext } from './types';
import { LAYOUT_CONFIG } from '../constants';

/** A node's width and height. */
interface Size {
  width: number;
  height: number;
}

/** A node's mutable position. */
interface Position {
  x: number;
  y: number;
}

/** A node's own dimensions, falling back to the base size when unknown. */
function dimOf(layoutCtx: LayoutContext, nodeId: string): Size {
  return (
    layoutCtx.nodeDimensions.get(nodeId) ?? {
      width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
      height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
    }
  );
}

/**
 * Pushes two overlapping nodes apart along the axis with the smaller overlap
 * (the least disruptive direction), mutating their positions in place.
 *
 * @returns True when the pair overlapped and was moved
 */
function resolvePair(
  posA: Position,
  dimA: Size,
  posB: Position,
  dimB: Size,
  spacing: number,
): boolean {
  // AABB overlap check with spacing
  const overlapX = posA.x < posB.x + dimB.width + spacing && posB.x < posA.x + dimA.width + spacing;
  const overlapY =
    posA.y < posB.y + dimB.height + spacing && posB.y < posA.y + dimA.height + spacing;
  if (!overlapX || !overlapY) return false;

  // Calculate overlap amounts on each axis
  const overlapAmountX = Math.min(
    posA.x + dimA.width + spacing - posB.x,
    posB.x + dimB.width + spacing - posA.x,
  );
  const overlapAmountY = Math.min(
    posA.y + dimA.height + spacing - posB.y,
    posB.y + dimB.height + spacing - posA.y,
  );

  // Push apart along the axis with less overlap (minimal disruption)
  if (overlapAmountX < overlapAmountY) {
    const pushX = (overlapAmountX / 2) * (posA.x <= posB.x ? -1 : 1);
    posA.x += pushX;
    posB.x -= pushX;
  } else {
    const pushY = (overlapAmountY / 2) * (posA.y <= posB.y ? -1 : 1);
    posA.y += pushY;
    posB.y -= pushY;
  }
  return true;
}

/**
 * Phase 6: Resolves node overlaps using AABB (rectangle) detection.
 *
 * For each pair of overlapping nodes, pushes them apart along the axis
 * with less overlap. Uses actual node dimensions for accurate detection.
 */
export function resolveOverlaps(nodes: JQNode[], layoutCtx: LayoutContext): void {
  const spacing = LAYOUT_CONFIG.NODE_MIN_SPACING;

  for (let iteration = 0; iteration < LAYOUT_CONFIG.COLLISION_MAX_ITERATIONS; iteration++) {
    let hadOverlap = false;

    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      if (!nodeA) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];
        if (!nodeB) continue;
        const posA = layoutCtx.nodePositions.get(nodeA.id);
        const posB = layoutCtx.nodePositions.get(nodeB.id);
        if (!posA || !posB) continue;

        const dimA = dimOf(layoutCtx, nodeA.id);
        const dimB = dimOf(layoutCtx, nodeB.id);
        if (resolvePair(posA, dimA, posB, dimB, spacing)) {
          hadOverlap = true;
        }
      }
    }

    if (!hadOverlap) break;
  }
}
