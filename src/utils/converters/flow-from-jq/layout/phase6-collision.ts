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

        const dimA = layoutCtx.nodeDimensions.get(nodeA.id) ?? {
          width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
          height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
        };
        const dimB = layoutCtx.nodeDimensions.get(nodeB.id) ?? {
          width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
          height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
        };

        // AABB overlap check with spacing
        const overlapX =
          posA.x < posB.x + dimB.width + spacing && posB.x < posA.x + dimA.width + spacing;
        const overlapY =
          posA.y < posB.y + dimB.height + spacing && posB.y < posA.y + dimA.height + spacing;

        if (overlapX && overlapY) {
          hadOverlap = true;

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
            // Push horizontally
            const pushX = overlapAmountX / 2;
            if (posA.x <= posB.x) {
              posA.x -= pushX;
              posB.x += pushX;
            } else {
              posA.x += pushX;
              posB.x -= pushX;
            }
          } else {
            // Push vertically
            const pushY = overlapAmountY / 2;
            if (posA.y <= posB.y) {
              posA.y -= pushY;
              posB.y += pushY;
            } else {
              posA.y += pushY;
              posB.y -= pushY;
            }
          }
        }
      }
    }

    if (!hadOverlap) break;
  }
}
