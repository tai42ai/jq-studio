/**
 * @fileoverview Validation utilities for JQ converter.
 */

import { type JQNode, type JQEdge } from '../../../../types';
import { JQNodeType } from '../../../../enums';
import { type ConversionContext } from '../types';
import { VALID_VARIABLE_NAME_REGEX, MAX_GRAPH_NODES } from '../constants';

/**
 * Validates that a variable name is a valid jq identifier.
 *
 * jq variable names must:
 * - Start with a letter (a-z, A-Z) or underscore (_)
 * - Followed by letters, digits, or underscores
 *
 * @param name - The variable name to validate
 * @throws {Error} If the variable name is invalid
 */
export function validateVariableName(name: string): void {
  if (!VALID_VARIABLE_NAME_REGEX.test(name)) {
    throw new Error(
      `Invalid variable name: "${name}". Variable names must start with a letter or underscore, ` +
        `followed by letters, digits, or underscores.`,
    );
  }
}

/**
 * Finds the Start node in the graph.
 *
 * @param context - Conversion context containing all nodes
 * @returns The Start node
 * @throws {Error} If no Start node exists or multiple Start nodes exist
 */
export function findStartNode(context: ConversionContext): JQNode {
  const startNodes = Array.from(context.nodes.values()).filter(
    (n) => n.data.type === JQNodeType.Start,
  );

  if (startNodes.length === 0) {
    throw new Error('Graph must contain exactly one Start node');
  }
  if (startNodes.length > 1) {
    throw new Error(`Graph contains ${String(startNodes.length)} Start nodes, expected exactly 1`);
  }

  const startNode = startNodes[0];
  if (!startNode) {
    throw new Error('Graph must contain exactly one Start node');
  }
  return startNode;
}

/**
 * Validates the input nodes and edges for conversion.
 *
 * Every generator and chain walk reads its next node out of the node map by an
 * edge's source or target, so an edge naming a node the graph does not contain
 * leaves the conversion with nothing to emit for a connection the flow draws.
 * The whole edge list is checked here, before anything is walked, so one
 * conversion reports every broken edge instead of stopping at the first one a
 * walk happens to reach — and every walk downstream can take both ends of an
 * edge as resolvable.
 *
 * @param nodes - Array of nodes to validate
 * @param edges - Array of edges to validate against those nodes
 * @throws {Error} If the graph is empty or holds more nodes than the converter allows
 * @throws {Error} If any edge names a source or target the graph does not contain
 */
export function validateInputs(nodes: JQNode[], edges: JQEdge[]): void {
  if (nodes.length === 0) {
    throw new Error('Cannot convert empty graph to jq expression');
  }

  if (nodes.length > MAX_GRAPH_NODES) {
    throw new Error(`Graph exceeds the maximum of ${String(MAX_GRAPH_NODES)} nodes`);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const dangling: string[] = [];
  for (const edge of edges) {
    const missingSource = !nodeIds.has(edge.source);
    const missingTarget = !nodeIds.has(edge.target);
    if (!missingSource && !missingTarget) continue;

    let missingEnd: string;
    if (missingSource && missingTarget) {
      missingEnd = 'source and target not in graph';
    } else if (missingSource) {
      missingEnd = 'source not in graph';
    } else {
      missingEnd = 'target not in graph';
    }
    dangling.push(
      `  edge ${edge.id}: source ${edge.source}, target ${edge.target} — ${missingEnd}`,
    );
  }

  if (dangling.length > 0) {
    throw new Error(
      `Graph contains ${String(dangling.length)} dangling edge${dangling.length === 1 ? '' : 's'} — ` +
        `remove the edge or restore the node:\n${dangling.join('\n')}`,
    );
  }
}

/**
 * Resolves the node at one end of an edge.
 *
 * {@link validateInputs} rejects every edge naming a node the graph does not
 * contain before anything is walked, so both ends of every edge the generators
 * read resolve. A miss here is a conversion that ran without that check, and
 * answering with nothing would let a generator emit an expression missing
 * whatever the edge connects.
 *
 * @throws {Error} If the node map does not hold the node
 */
function resolveEdgeEnd(context: ConversionContext, edge: JQEdge, nodeId: string): JQNode {
  const node = context.nodes.get(nodeId);
  if (!node) {
    throw new Error(
      `Edge ${edge.id} names node ${nodeId}, which the graph does not contain — ` +
        'the conversion skipped its graph-integrity check',
    );
  }
  return node;
}

/**
 * Resolves the node an edge points at.
 *
 * @see {@link resolveEdgeEnd} for why a miss is an error rather than an absent node
 */
export function edgeTargetNode(context: ConversionContext, edge: JQEdge): JQNode {
  return resolveEdgeEnd(context, edge, edge.target);
}

/**
 * Resolves the node an edge leaves.
 *
 * @see {@link resolveEdgeEnd} for why a miss is an error rather than an absent node
 */
export function edgeSourceNode(context: ConversionContext, edge: JQEdge): JQNode {
  return resolveEdgeEnd(context, edge, edge.source);
}

/**
 * Records a node a chain walk has stepped onto, rejecting one the walk already
 * passed through.
 *
 * A chain walk follows bottom-handle edges until it reaches a node that has none.
 * An edge leading back to a node earlier in the same walk gives the walk no end,
 * so the conversion fails here rather than following the loop until the process
 * runs out of memory.
 *
 * Each walk keeps its own set: the same node legitimately appears in a chain the
 * main flow walks and in a chain a branch, parameter or operand walks.
 *
 * @param visited - The node ids this walk has passed through, added to in place
 * @param node - The node the walk has stepped onto
 * @param edge - The bottom-handle edge that led to it, named in the error
 * @throws {Error} If this walk already passed through the node
 */
export function enterChainNode(visited: Set<string>, node: JQNode, edge: JQEdge): void {
  if (visited.has(node.id)) {
    throw new Error(
      `Chain cycle detected at node ${node.id} — bottom edge ${edge.id} leads back to a node ` +
        'the chain already passed through — remove the edge',
    );
  }
  visited.add(node.id);
}
