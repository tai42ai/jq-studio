/**
 * @fileoverview Type definitions for layout algorithm.
 */

import { type JQEdge } from '../../../../types';

/**
 * Edge classification for layout purposes.
 *
 * - flow: bottom→top pipe edges (vertical chain)
 * - start-flow: Start.flow→node.top (beginning of main chain)
 * - branch: right-side source handles (if, then, else, try, catch, param, item, field, logic, functions)
 * - operator: edges targeting operator-left or operator-right handles
 */
export type EdgeKind = 'flow' | 'start-flow' | 'branch' | 'operator';

export interface ClassifiedEdge {
  edge: JQEdge;
  kind: EdgeKind;
}

export interface NodeDimensions {
  width: number;
  height: number;
}

/**
 * Layout context for positioning algorithm.
 */
export interface LayoutContext {
  /** Depth level for each node (Y axis) — flow edges only */
  layers: Map<number, string[]>;

  /** Node ID to depth mapping — flow edges only */
  nodeDepths: Map<string, number>;

  /** Node ID to estimated visual dimensions (width and height) */
  nodeDimensions: Map<string, NodeDimensions>;

  /** Classified edges */
  classifiedEdges: ClassifiedEdge[];

  /** Flow edges only (bottom→top + start-flow) */
  flowEdges: JQEdge[];

  /** Branch edges grouped by source node */
  branchEdgesBySource: Map<string, JQEdge[]>;

  /** Operator edges grouped by target (operator) node */
  operatorEdgesByTarget: Map<string, { left?: JQEdge; right?: JQEdge }>;

  /** Reverse lookup: left operand node ID → operator node ID */
  operatorChainBySource: Map<string, string>;

  /** Flow parent: child → parent (via flow edges) */
  flowParent: Map<string, string>;

  /** Flow children: parent → first child (via flow edges, single child per node) */
  flowChildren: Map<string, string>;

  /** Sub-tree bounding box cache: nodeId → {width, height} */
  subTreeSizes: Map<string, { width: number; height: number }>;

  /** Conditional parent to branch children mapping */
  branchGroups: Map<string, string[]>;

  /** Function declaration to logic nodes mapping */
  functionGroups: Map<string, string[]>;

  /** Final position for each node */
  nodePositions: Map<string, { x: number; y: number }>;

  /** Set of nodes that have been positioned */
  positionedNodes: Set<string>;

  /** The Start node ID */
  startNodeId: string | null;
}
