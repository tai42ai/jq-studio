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

/** A sub-tree's bounding box. */
interface Size {
  width: number;
  height: number;
}

/** Computes (and memoizes) the sub-tree bounding box rooted at a node. */
type ComputeFn = (nodeId: string) => Size;

/** A node's own dimensions, falling back to the base size when unknown. */
function nodeDim(layoutCtx: LayoutContext, nodeId: string): Size {
  return (
    layoutCtx.nodeDimensions.get(nodeId) ?? {
      width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
      height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
    }
  );
}

/** Extent of the branch sub-trees stacked vertically to the right of a node. */
function branchColumn(nodeId: string, layoutCtx: LayoutContext, compute: ComputeFn): Size {
  let width = 0;
  let height = 0;
  const branchEdges = layoutCtx.branchEdgesBySource.get(nodeId) ?? [];
  for (const edge of branchEdges) {
    const branchSize = compute(edge.target);
    width = Math.max(width, branchSize.width);
    height += branchSize.height + LAYOUT_CONFIG.BRANCH_GAP_Y;
  }
  // Remove trailing gap
  if (branchEdges.length > 0) {
    height -= LAYOUT_CONFIG.BRANCH_GAP_Y;
  }
  return { width, height };
}

/**
 * Extent of a node's operator operands — those hanging to its left and right,
 * plus, when the node is itself a left operand, the operator and its right
 * operand (computed directly to avoid a cycle through the operator node).
 */
function operandExtent(nodeId: string, layoutCtx: LayoutContext, compute: ComputeFn): Size {
  let width = 0;
  let height = 0;

  const operatorEntry = layoutCtx.operatorEdgesByTarget.get(nodeId);
  if (operatorEntry?.left) {
    const leftSize = compute(operatorEntry.left.source);
    width += leftSize.width + LAYOUT_CONFIG.OPERAND_GAP;
    height = Math.max(height, leftSize.height);
  }
  if (operatorEntry?.right) {
    const rightSize = compute(operatorEntry.right.source);
    width += rightSize.width + LAYOUT_CONFIG.OPERAND_GAP;
    height = Math.max(height, rightSize.height);
  }

  const operatorChainId = layoutCtx.operatorChainBySource.get(nodeId);
  if (operatorChainId) {
    const opDim = nodeDim(layoutCtx, operatorChainId);
    let chainWidth = LAYOUT_CONFIG.OPERAND_GAP + opDim.width;
    let chainHeight = opDim.height;
    const opEntry = layoutCtx.operatorEdgesByTarget.get(operatorChainId);
    if (opEntry?.right) {
      const rightSize = compute(opEntry.right.source);
      chainWidth += LAYOUT_CONFIG.OPERAND_GAP + rightSize.width;
      chainHeight = Math.max(chainHeight, rightSize.height);
    }
    width += chainWidth;
    height = Math.max(height, chainHeight);
  }

  return { width, height };
}

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
  // Track nodes being computed to prevent infinite loops with shared nodes
  const computing = new Set<string>();

  function compute(nodeId: string): Size {
    // Return cached result
    const cachedSize = layoutCtx.subTreeSizes.get(nodeId);
    if (cachedSize) {
      return cachedSize;
    }

    const dim = nodeDim(layoutCtx, nodeId);

    // Prevent infinite recursion on shared nodes (variables)
    if (computing.has(nodeId)) {
      return { width: dim.width, height: dim.height };
    }
    computing.add(nodeId);

    const branches = branchColumn(nodeId, layoutCtx, compute);
    const operands = operandExtent(nodeId, layoutCtx, compute);

    // Width with branches: node width + gap + branch column width
    const widthWithBranches =
      branches.width > 0 ? dim.width + LAYOUT_CONFIG.BRANCH_OFFSET_X + branches.width : dim.width;

    // Width with operands: operand widths + node width
    const widthWithOperands = operands.width > 0 ? operands.width + dim.width : 0;

    // Local height: max of own height, branch column, operand height
    const localHeight = Math.max(dim.height, branches.height, operands.height);

    // Compute flow child sub-tree size
    const flowChildId = layoutCtx.flowChildren.get(nodeId);
    let childWidth = 0;
    let childHeight = 0;
    if (flowChildId) {
      const childSize = compute(flowChildId);
      childWidth = childSize.width;
      childHeight = LAYOUT_CONFIG.LAYER_SPACING + childSize.height;
    }

    const result: Size = {
      width: Math.max(widthWithBranches, widthWithOperands, childWidth),
      height: localHeight + childHeight,
    };
    layoutCtx.subTreeSizes.set(nodeId, result);
    computing.delete(nodeId);
    return result;
  }

  // Compute for all nodes (starting from roots for efficiency, but memoization handles order)
  for (const node of nodes) {
    compute(node.id);
  }
}
