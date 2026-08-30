/**
 * @fileoverview Utility functions for node and edge creation.
 */

import { type ConversionContext } from '../types';

/**
 * Generates a unique node ID.
 *
 * @param context - Conversion context
 * @returns Unique node ID string
 */
export function generateNodeId(context: ConversionContext): string {
  return `jq_node_${String(context.nodeIdCounter++)}`;
}

/**
 * Generates a unique edge ID.
 *
 * @param context - Conversion context
 * @returns Unique edge ID string
 */
export function generateEdgeId(context: ConversionContext): string {
  return `jq_edge_${String(context.edgeIdCounter++)}`;
}

/**
 * Creates an edge between two nodes.
 *
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @param sourceHandle - Source handle ID
 * @param targetHandle - Target handle ID
 * @param context - Conversion context
 * @returns The created edge
 */
export function createEdge(
  sourceId: string,
  targetId: string,
  sourceHandle: string,
  targetHandle: string,
  context: ConversionContext,
) {
  const edge = {
    id: generateEdgeId(context),
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    type: 'gradient' as const,
  };
  context.edges.push(edge);
  return edge;
}
