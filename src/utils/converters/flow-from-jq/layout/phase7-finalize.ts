/**
 * @fileoverview Phase 7: Position finalization.
 *
 * Normalizes all node positions to positive coordinate space
 * with padding, using actual node dimensions for awareness.
 */

import { type JQNode } from '../../../../types';
import { type LayoutContext } from './types';
import { LAYOUT_CONFIG } from '../constants';

/**
 * Phase 7: Finalizes positions by normalizing to positive space.
 *
 * Finds the minimum X and Y coordinates across all nodes and shifts
 * all positions to ensure they start from (PADDING, PADDING).
 */
export function finalizePositions(nodes: JQNode[], layoutCtx: LayoutContext): void {
  // Find bounds
  let minX = Infinity;
  let minY = Infinity;

  for (const pos of layoutCtx.nodePositions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }

  // Handle edge case: no positions computed
  if (minX === Infinity) minX = 0;
  if (minY === Infinity) minY = 0;

  // Apply padding and update node positions
  for (const node of nodes) {
    const pos = layoutCtx.nodePositions.get(node.id);

    if (!pos) {
      // Defensive: node without a computed position
      console.warn(`Node ${node.id} (${node.data.type}) has no computed position, using default`);
      node.position = {
        x: LAYOUT_CONFIG.PADDING,
        y: LAYOUT_CONFIG.PADDING,
      };
      continue;
    }

    node.position = {
      x: Math.round(pos.x - minX + LAYOUT_CONFIG.PADDING),
      y: Math.round(pos.y - minY + LAYOUT_CONFIG.PADDING),
    };
  }
}
