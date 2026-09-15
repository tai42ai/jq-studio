/**
 * @fileoverview Phase 4: Recursive tree-walk positioning (THE CORE).
 *
 * Positions ALL nodes via a single recursive descent from the Start node.
 * - Pipe chain nodes flow top-to-bottom (vertical)
 * - Branch targets fan out to the right (horizontal)
 * - Operator operands are placed to the left and right
 * - Function declarations are placed to the right of Start
 */

import { JQHandleIdPrefix } from '../../../../enums';
import { type JQEdge } from '../../../../types';
import { LAYOUT_CONFIG } from '../constants';
import { type LayoutContext } from './types';

/**
 * Phase 4: Positions all nodes via recursive tree-walk.
 *
 * Entry point: Start node at top-left, then:
 * 1. Function declarations to the right of Start
 * 2. Main flow chain below Start
 * 3. Each node's branches to the right, operands to left/right
 * 4. Flow children below
 */
export function positionAllNodes(layoutCtx: LayoutContext): void {
  if (!layoutCtx.startNodeId) return;

  const startDim = layoutCtx.nodeDimensions.get(layoutCtx.startNodeId) ?? {
    width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
    height: 110,
  };

  // Position Start node
  const startX = LAYOUT_CONFIG.PADDING;
  const startY = LAYOUT_CONFIG.START_Y;
  setPosition(layoutCtx.startNodeId, startX, startY, layoutCtx);

  // Get branch edges from Start (functions--- and any others)
  const startBranches = layoutCtx.branchEdgesBySource.get(layoutCtx.startNodeId) ?? [];

  // Separate function declarations from other branches
  const funcEdges = startBranches.filter((e) =>
    (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.Functions),
  );

  // Position function declarations to the right of Start
  let funcY = startY;
  let funcBottomY = startY;
  const funcX = startX + startDim.width + LAYOUT_CONFIG.FUNCTION_DECL_OFFSET_X;
  for (const funcEdge of funcEdges) {
    const result = positionSubTree(funcEdge.target, funcX, funcY, layoutCtx);
    funcY += result.height + LAYOUT_CONFIG.FUNCTION_DECL_GAP_Y;
    funcBottomY = funcY;
  }

  // Position main flow chain below both Start and all FuncDecl sub-trees
  const flowChildId = layoutCtx.flowChildren.get(layoutCtx.startNodeId);
  if (flowChildId) {
    const startBottom = startY + startDim.height;
    const chainY = Math.max(startBottom, funcBottomY) + LAYOUT_CONFIG.LAYER_SPACING;
    positionSubTree(flowChildId, startX, chainY, layoutCtx);
  }
}

/** A sub-tree's bounding box. */
interface Size {
  width: number;
  height: number;
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
 * Positions a node's branch sub-trees, stacked top-to-bottom to its right.
 *
 * @returns The widest branch and the total height the column occupies
 */
function positionBranches(
  nodeId: string,
  x: number,
  y: number,
  dim: Size,
  layoutCtx: LayoutContext,
): { maxWidth: number; totalHeight: number } {
  const branchEdges = layoutCtx.branchEdgesBySource.get(nodeId) ?? [];
  if (branchEdges.length === 0) return { maxWidth: 0, totalHeight: 0 };

  const branchX = x + dim.width + LAYOUT_CONFIG.BRANCH_OFFSET_X;
  let branchY = y;
  let maxWidth = 0;

  // Sort branch edges by handle index for consistent ordering
  for (const branchEdge of sortBranchEdges(branchEdges)) {
    const result = positionSubTree(branchEdge.target, branchX, branchY, layoutCtx);
    maxWidth = Math.max(maxWidth, result.width);
    branchY += result.height + LAYOUT_CONFIG.BRANCH_GAP_Y;
  }

  return { maxWidth, totalHeight: branchY - y - LAYOUT_CONFIG.BRANCH_GAP_Y };
}

/**
 * Positions a node's operator operands — the left operand to its left, the right
 * operand (or the operator chain, when this node is itself a left operand) to
 * its right. Operands already placed via a shared variable are left in place.
 *
 * @returns The width consumed left and right of the node and the tallest operand
 */
function positionOperands(
  nodeId: string,
  x: number,
  y: number,
  dim: Size,
  layoutCtx: LayoutContext,
): { leftWidth: number; rightWidth: number; maxHeight: number } {
  let leftWidth = 0;
  let rightWidth = 0;
  let maxHeight = 0;

  const operatorEntry = layoutCtx.operatorEdgesByTarget.get(nodeId);

  // Left operand: position to the LEFT of this node
  const leftId = operatorEntry?.left?.source;
  if (leftId !== undefined && !layoutCtx.positionedNodes.has(leftId)) {
    const leftDim = dimOf(layoutCtx, leftId);
    const leftX = x - LAYOUT_CONFIG.OPERAND_GAP - leftDim.width;
    const leftResult = positionSubTree(leftId, leftX, y, layoutCtx);
    leftWidth = leftResult.width + LAYOUT_CONFIG.OPERAND_GAP;
    maxHeight = Math.max(maxHeight, leftResult.height);
  }

  // Right operand: position to the RIGHT of this node
  const rightId = operatorEntry?.right?.source;
  if (rightId !== undefined && !layoutCtx.positionedNodes.has(rightId)) {
    const rightX = x + dim.width + LAYOUT_CONFIG.OPERAND_GAP;
    const rightResult = positionSubTree(rightId, rightX, y, layoutCtx);
    rightWidth = rightResult.width + LAYOUT_CONFIG.OPERAND_GAP;
    maxHeight = Math.max(maxHeight, rightResult.height);
  }

  // Operator chain to the right, when this node is a left operand
  const operatorChainId = layoutCtx.operatorChainBySource.get(nodeId);
  if (operatorChainId && !layoutCtx.positionedNodes.has(operatorChainId)) {
    const opX = x + dim.width + LAYOUT_CONFIG.OPERAND_GAP;
    const opResult = positionSubTree(operatorChainId, opX, y, layoutCtx);
    rightWidth = LAYOUT_CONFIG.OPERAND_GAP + opResult.width;
    maxHeight = Math.max(maxHeight, opResult.height);
  }

  return { leftWidth, rightWidth, maxHeight };
}

/**
 * Positions a sub-tree rooted at nodeId, starting at (x, y).
 *
 * Recursively positions:
 * 1. The node itself
 * 2. Branch targets to the right
 * 3. Operator operands to the left/right
 * 4. Flow child below
 *
 * @returns Bounding box of the positioned sub-tree
 */
function positionSubTree(nodeId: string, x: number, y: number, layoutCtx: LayoutContext): Size {
  // Skip already-positioned nodes (shared via variables)
  if (layoutCtx.positionedNodes.has(nodeId)) {
    const dim = dimOf(layoutCtx, nodeId);
    return { width: dim.width, height: dim.height };
  }

  // Position this node
  setPosition(nodeId, x, y, layoutCtx);
  const dim = dimOf(layoutCtx, nodeId);

  const branches = positionBranches(nodeId, x, y, dim, layoutCtx);
  const operands = positionOperands(nodeId, x, y, dim, layoutCtx);

  const localHeight = Math.max(dim.height, branches.totalHeight, operands.maxHeight);
  const flowChildId = layoutCtx.flowChildren.get(nodeId);

  let childWidth = 0;
  let childHeight = 0;
  if (flowChildId && !layoutCtx.positionedNodes.has(flowChildId)) {
    const childY = y + localHeight + LAYOUT_CONFIG.LAYER_SPACING;
    const childResult = positionSubTree(flowChildId, x, childY, layoutCtx);
    childWidth = childResult.width;
    childHeight = LAYOUT_CONFIG.LAYER_SPACING + childResult.height;
  }

  // Compute total bounding box
  const branchWidth = branches.maxWidth > 0 ? LAYOUT_CONFIG.BRANCH_OFFSET_X + branches.maxWidth : 0;

  return {
    width: Math.max(
      dim.width + branchWidth,
      operands.leftWidth + dim.width + operands.rightWidth,
      childWidth,
    ),
    height: localHeight + childHeight,
  };
}

/**
 * Sets a node's position and marks it as positioned.
 */
function setPosition(nodeId: string, x: number, y: number, layoutCtx: LayoutContext): void {
  layoutCtx.nodePositions.set(nodeId, { x, y });
  layoutCtx.positionedNodes.add(nodeId);
}

/**
 * Sorts branch edges by handle type and index for consistent visual ordering.
 *
 * Order: if:0, then:0, if:1, then:1, ..., else, try, catch, param:0, param:1, ...,
 * item:0, item:1, ..., field:0, field:1, ..., logic, functions, root, other
 */
function sortBranchEdges(edges: JQEdge[]): JQEdge[] {
  return [...edges].sort((a, b) => {
    const aKey = branchSortKey(a.sourceHandle ?? '');
    const bKey = branchSortKey(b.sourceHandle ?? '');
    return aKey - bKey;
  });
}

/**
 * Assigns a numeric sort key to a branch handle for ordering.
 */
function branchSortKey(handle: string): number {
  // Condition branches: if and then interleaved
  if (handle.startsWith(JQHandleIdPrefix.If)) {
    const idx = parseHandleIndex(handle);
    return 100 + idx * 2; // if:0 = 100, if:1 = 102, ...
  }
  if (handle.startsWith(JQHandleIdPrefix.Then)) {
    const idx = parseHandleIndex(handle);
    return 101 + idx * 2; // then:0 = 101, then:1 = 103, ...
  }
  if (handle.startsWith(JQHandleIdPrefix.Else)) return 200;

  // TryCatch branches
  if (handle.startsWith(JQHandleIdPrefix.Try)) return 300;
  if (handle.startsWith(JQHandleIdPrefix.Catch)) return 301;

  // Function params
  if (handle.startsWith(JQHandleIdPrefix.Param)) {
    const idx = parseHandleIndex(handle);
    return 400 + idx;
  }

  // Array items
  if (handle.startsWith(JQHandleIdPrefix.Item)) {
    const idx = parseHandleIndex(handle);
    return 500 + idx;
  }

  // Object fields
  if (handle.startsWith(JQHandleIdPrefix.Field)) {
    const idx = parseHandleIndex(handle);
    return 600 + idx;
  }

  // Function logic
  if (handle.startsWith(JQHandleIdPrefix.Logic)) return 700;

  // Functions from Start
  if (handle.startsWith(JQHandleIdPrefix.Functions)) return 800;

  // Root
  if (handle.startsWith(JQHandleIdPrefix.Root)) return 900;

  return 1000;
}

/**
 * Extracts the numeric index from a handle ID like "param---:2" → 2.
 */
function parseHandleIndex(handle: string): number {
  const parts = handle.split(':');
  if (parts.length >= 2) {
    const num = parseInt(parts[1] ?? '', 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}
