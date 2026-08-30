/**
 * @fileoverview Phase 4: Recursive tree-walk positioning (THE CORE).
 *
 * Positions ALL nodes via a single recursive descent from the Start node.
 * - Pipe chain nodes flow top-to-bottom (vertical)
 * - Branch targets fan out to the right (horizontal)
 * - Operator operands are placed to the left and right
 * - Function declarations are placed to the right of Start
 */

import { type JQEdge } from '../../../../types';
import { JQHandleIdPrefix } from '../../../../enums';
import { type LayoutContext } from './types';
import { LAYOUT_CONFIG } from '../constants';

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
function positionSubTree(
  nodeId: string,
  x: number,
  y: number,
  layoutCtx: LayoutContext,
): { width: number; height: number } {
  // Skip already-positioned nodes (shared via variables)
  if (layoutCtx.positionedNodes.has(nodeId)) {
    const dim = layoutCtx.nodeDimensions.get(nodeId) ?? {
      width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
      height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
    };
    return { width: dim.width, height: dim.height };
  }

  // Position this node
  setPosition(nodeId, x, y, layoutCtx);

  const dim = layoutCtx.nodeDimensions.get(nodeId) ?? {
    width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
    height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
  };

  // --- 1. Position BRANCHES to the right ---
  const branchEdges = layoutCtx.branchEdgesBySource.get(nodeId) ?? [];
  let branchMaxWidth = 0;
  let branchTotalHeight = 0;

  if (branchEdges.length > 0) {
    const branchX = x + dim.width + LAYOUT_CONFIG.BRANCH_OFFSET_X;
    let branchY = y;

    // Sort branch edges by handle index for consistent ordering
    const sortedBranches = sortBranchEdges(branchEdges);

    for (const branchEdge of sortedBranches) {
      const result = positionSubTree(branchEdge.target, branchX, branchY, layoutCtx);
      branchMaxWidth = Math.max(branchMaxWidth, result.width);
      branchY += result.height + LAYOUT_CONFIG.BRANCH_GAP_Y;
    }

    branchTotalHeight = branchY - y;
    if (sortedBranches.length > 0) {
      branchTotalHeight -= LAYOUT_CONFIG.BRANCH_GAP_Y;
    }
  }

  // --- 2. Position OPERATOR OPERANDS to left and right ---
  let operandLeftWidth = 0;
  let operandRightWidth = 0;
  let operandMaxHeight = 0;

  const operatorEntry = layoutCtx.operatorEdgesByTarget.get(nodeId);
  if (operatorEntry) {
    // Left operand: position to the LEFT of this node
    if (operatorEntry.left) {
      const leftId = operatorEntry.left.source;
      if (!layoutCtx.positionedNodes.has(leftId)) {
        const leftDim = layoutCtx.nodeDimensions.get(leftId) ?? {
          width: LAYOUT_CONFIG.NODE_BASE_WIDTH,
          height: LAYOUT_CONFIG.NODE_BASE_HEIGHT,
        };
        const leftX = x - LAYOUT_CONFIG.OPERAND_GAP - leftDim.width;
        const leftResult = positionSubTree(leftId, leftX, y, layoutCtx);
        operandLeftWidth = leftResult.width + LAYOUT_CONFIG.OPERAND_GAP;
        operandMaxHeight = Math.max(operandMaxHeight, leftResult.height);
      }
    }

    // Right operand: position to the RIGHT of this node
    if (operatorEntry.right) {
      const rightId = operatorEntry.right.source;
      if (!layoutCtx.positionedNodes.has(rightId)) {
        const rightX = x + dim.width + LAYOUT_CONFIG.OPERAND_GAP;
        const rightResult = positionSubTree(rightId, rightX, y, layoutCtx);
        operandRightWidth = rightResult.width + LAYOUT_CONFIG.OPERAND_GAP;
        operandMaxHeight = Math.max(operandMaxHeight, rightResult.height);
      }
    }
  }

  // --- 2b. Position OPERATOR CHAIN to the right (when this node is left operand) ---
  const operatorChainId = layoutCtx.operatorChainBySource.get(nodeId);
  if (operatorChainId && !layoutCtx.positionedNodes.has(operatorChainId)) {
    const opX = x + dim.width + LAYOUT_CONFIG.OPERAND_GAP;
    const opResult = positionSubTree(operatorChainId, opX, y, layoutCtx);
    operandRightWidth = LAYOUT_CONFIG.OPERAND_GAP + opResult.width;
    operandMaxHeight = Math.max(operandMaxHeight, opResult.height);
  }

  // --- 3. Position FLOW CHILD below ---
  const localHeight = Math.max(dim.height, branchTotalHeight, operandMaxHeight);
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
  const branchWidth = branchMaxWidth > 0 ? LAYOUT_CONFIG.BRANCH_OFFSET_X + branchMaxWidth : 0;

  const totalWidth = Math.max(
    dim.width + branchWidth,
    operandLeftWidth + dim.width + operandRightWidth,
    childWidth,
  );
  const totalHeight = localHeight + childHeight;

  return { width: totalWidth, height: totalHeight };
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
