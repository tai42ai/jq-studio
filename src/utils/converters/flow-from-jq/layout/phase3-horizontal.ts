/**
 * @fileoverview Phase 3: Compute sub-tree bounding boxes (bottom-up).
 *
 * For every node, computes the total width and height of the sub-tree
 * rooted at that node. This accounts for:
 * - The node's own dimensions
 * - Branch sub-trees fanning out to the right
 * - Operator operand sub-trees to the left and right
 * - Flow children continuing downward
 *
 * Results are cached in layoutCtx.subTreeSizes for use by Phase 4.
 */

import { type JQNode } from '../../../../types';
import { type LayoutContext } from './types';
import { LAYOUT_CONFIG } from '../constants';

/**
 * Phase 3: Computes sub-tree bounding boxes for all nodes.
 *
 * Uses recursive bottom-up computation with memoization.
 * The bounding box of a node's sub-tree includes:
 * - The node itself
 * - All branch targets stacked vertically to the right
 * - Operator operands to the left/right
 * - Flow children continuing below
 */
export function computeSubTreeSizes(nodes: JQNode[], layoutCtx: LayoutContext): void {
  const nodeMap = new Map<string, JQNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Track nodes being computed to prevent infinite loops with shared nodes
  const computing = new Set<string>();

  function compute(nodeId: string): { width: number; height: number } {
    // Return cached result
    const cachedSize = layoutCtx.subTreeSizes.get(nodeId);
    if (cachedSize) {
      return cachedSize;
    }

    // Prevent infinite recursion on shared nodes (variables)
    if (computing.has(nodeId)) {
      const dim = layoutCtx.nodeDimensions.get(nodeId) ?? {
        width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
        height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
      };
      return { width: dim.width, height: dim.height };
    }
    computing.add(nodeId);

    const dim = layoutCtx.nodeDimensions.get(nodeId) ?? {
      width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
      height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
    };

    // Compute branch sub-tree sizes (stacked vertically to the right)
    let branchColumnWidth = 0;
    let branchColumnHeight = 0;
    const branchEdges = layoutCtx.branchEdgesBySource.get(nodeId) ?? [];
    for (const edge of branchEdges) {
      const branchSize = compute(edge.target);
      branchColumnWidth = Math.max(branchColumnWidth, branchSize.width);
      branchColumnHeight += branchSize.height + LAYOUT_CONFIG.BRANCH_GAP_Y;
    }
    // Remove trailing gap
    if (branchEdges.length > 0) {
      branchColumnHeight -= LAYOUT_CONFIG.BRANCH_GAP_Y;
    }

    // Compute operator operand sub-tree sizes (to the left and right)
    let operandTotalWidth = 0;
    let operandMaxHeight = 0;
    const operatorEntry = layoutCtx.operatorEdgesByTarget.get(nodeId);
    if (operatorEntry) {
      if (operatorEntry.left) {
        const leftSize = compute(operatorEntry.left.source);
        operandTotalWidth += leftSize.width + LAYOUT_CONFIG.OPERAND_GAP;
        operandMaxHeight = Math.max(operandMaxHeight, leftSize.height);
      }
      if (operatorEntry.right) {
        const rightSize = compute(operatorEntry.right.source);
        operandTotalWidth += rightSize.width + LAYOUT_CONFIG.OPERAND_GAP;
        operandMaxHeight = Math.max(operandMaxHeight, rightSize.height);
      }
    }

    // If this node is a left operand, include operator + right operand width
    // (computed directly to avoid circular dependency with compute(operatorId))
    const operatorChainId = layoutCtx.operatorChainBySource.get(nodeId);
    if (operatorChainId) {
      const opDim = layoutCtx.nodeDimensions.get(operatorChainId) ?? {
        width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
        height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
      };
      let chainWidth = LAYOUT_CONFIG.OPERAND_GAP + opDim.width;
      let chainHeight = opDim.height;
      const opEntry = layoutCtx.operatorEdgesByTarget.get(operatorChainId);
      if (opEntry?.right) {
        const rightSize = compute(opEntry.right.source);
        chainWidth += LAYOUT_CONFIG.OPERAND_GAP + rightSize.width;
        chainHeight = Math.max(chainHeight, rightSize.height);
      }
      operandTotalWidth += chainWidth;
      operandMaxHeight = Math.max(operandMaxHeight, chainHeight);
    }

    // Width with branches: node width + gap + branch column width
    const widthWithBranches =
      branchColumnWidth > 0
        ? dim.width + LAYOUT_CONFIG.BRANCH_OFFSET_X + branchColumnWidth
        : dim.width;

    // Width with operands: operand widths + node width
    const widthWithOperands = operandTotalWidth > 0 ? operandTotalWidth + dim.width : 0;

    // Local height: max of own height, branch column, operand height
    const localHeight = Math.max(dim.height, branchColumnHeight, operandMaxHeight);

    // Compute flow child sub-tree size
    const flowChildId = layoutCtx.flowChildren.get(nodeId);
    let childWidth = 0;
    let childHeight = 0;
    if (flowChildId) {
      const childSize = compute(flowChildId);
      childWidth = childSize.width;
      childHeight = LAYOUT_CONFIG.LAYER_SPACING + childSize.height;
    }

    const totalWidth = Math.max(widthWithBranches, widthWithOperands, childWidth);
    const totalHeight = localHeight + childHeight;

    const result = { width: totalWidth, height: totalHeight };
    layoutCtx.subTreeSizes.set(nodeId, result);
    computing.delete(nodeId);
    return result;
  }

  // Compute for all nodes (starting from roots for efficiency, but memoization handles order)
  for (const node of nodes) {
    compute(node.id);
  }
}
