/**
 * @fileoverview Type definitions for JQ from Flow converter.
 */

import { type JQNode, type JQEdge } from '../../../types';

/**
 * Context passed through the conversion process to maintain state
 * and provide efficient data access.
 */
export interface ConversionContext {
  /** Map of node IDs to node objects for O(1) lookup */
  nodes: Map<string, JQNode>;

  /** All edges in the graph */
  edges: JQEdge[];

  /** Map of target node ID to all edges targeting it */
  edgesByTarget: Map<string, JQEdge[]>;

  /** Map of source node ID to all edges originating from it */
  edgesBySource: Map<string, JQEdge[]>;

  /** Cache of generated expressions for each node to avoid recomputation */
  nodeExpressions: Map<string, string>;

  /** Set of node IDs that should create variables in the expression chain */
  variableNodes: Set<string>;

  /** Set of visited nodes during traversal to detect cycles */
  visited: Set<string>;

  /** Custom functions defined in this graph (name -> params) */
  customFunctions: Map<string, string[]>;
}

/**
 * Result of classifying an edge connection type.
 */
export interface EdgeClassification {
  /** Whether this edge represents a side handle connection (param, item, field, etc.) */
  isSideHandle: boolean;

  /** Whether this edge represents a bottom handle connection (main flow chain) */
  isBottomHandle: boolean;

  /** The handle type (if identifiable) */
  handleType: string | null;
}
