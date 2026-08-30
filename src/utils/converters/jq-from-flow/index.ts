/**
 * @fileoverview Main entry point for JQ from Flow converter.
 *
 * Converts visual JQ flow graphs to jq expression strings.
 */

import { type JQNode, type JQEdge } from '../../../types';
import { type ConversionContext } from './types';
import { buildEdgeMaps } from './utils/edge-classifier';
import { validateInputs, findStartNode } from './utils/validators';
import { shouldCreateVariable, buildMainExpression } from './expression-builder';
import { generateFunctionDeclarations } from './generators/function-generator';
import { generateNodeExpression } from './generators/node-generator';

/**
 * Converts a visual JQ flow graph to a jq expression string.
 *
 * This function performs a multi-phase conversion:
 * 1. Validates the inputs: the graph holds at least one node and no more than the
 *    converter's node limit, and every edge connects two nodes the graph contains
 * 2. Extracts function declarations from the Start node's "functions" handle
 * 3. Builds the main expression chain by walking the graph from the Start node,
 *    rejecting a chain that loops back on itself
 * 4. Combines function declarations and main expression
 *
 * Variable Creation Rules (name-based, using `as $var | $var` pattern):
 * - Nodes with a non-empty name create variables: `expr as $name | $name`
 * - Unnamed nodes pass their expression through without creating a variable
 * - Operator and Condition nodes NEVER create variables (always inline)
 * - Start and FunctionDecl nodes NEVER create variables
 *
 * Supported Features:
 * ✅ All 6 node types: Start, FunctionDecl, FunctionCall, Value, Operator, Condition
 * ✅ All value types: string, number, boolean, array, object, path, null
 * ✅ All operators from operator catalog
 * ✅ All 60+ built-in functions
 * ✅ Custom function declarations with parameters
 * ✅ Path expressions with all segment types
 * ✅ Variable assignments and references
 * ✅ Multi-branch conditionals (if/elif/else)
 * ✅ String escaping with unicode support
 *
 * Limitations:
 * ⚠️ Maximum graph size: 1000 nodes
 * ⚠️ Variable names must be valid jq identifiers
 *
 * @param nodes - Array of JQ flow nodes (must include exactly one Start node)
 * @param edges - Array of edges connecting the nodes
 *
 * @returns The compiled jq expression as a string
 *
 * @throws {Error} If no Start node exists
 * @throws {Error} If multiple Start nodes exist
 * @throws {Error} If a bottom-handle chain loops back on a node it already passed through
 * @throws {Error} If a node's expression depends on itself through a side handle
 * @throws {Error} If required connections are missing
 * @throws {Error} If any edge names a source or target the graph does not contain
 * @throws {Error} If variable names are invalid
 * @throws {Error} If the graph holds more nodes than the converter allows
 *
 * @example
 * // Simple linear flow
 * const nodes = [
 *   { id: 'start', type: JQNodeType.Start, data: { type: JQNodeType.Start, name: 'start' }, position: { x: 0, y: 0 } },
 *   { id: 'map', type: JQNodeType.FunctionCall, data: { type: JQNodeType.FunctionCall, name: 'myMap', callType: 'builtin', selectedFunction: 'map' }, position: { x: 0, y: 200 } }
 * ];
 * const edges = [
 *   { id: 'e1', source: 'start', target: 'map', sourceHandle: JQHandleIdPrefix.Flow, targetHandle: JQHandleIdPrefix.Top }
 * ];
 * const jq = convertFlowToJQ(nodes, edges);
 * // Returns: "map as $myMap | $myMap"
 *
 * @see {@link https://jqlang.github.io/jq/manual/|jq Manual} for jq syntax reference
 */
export function convertFlowToJQ(nodes: JQNode[], edges: JQEdge[]): string {
  // Validate inputs
  validateInputs(nodes, edges);

  // Build conversion context
  const nodeMap = new Map<string, JQNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const { edgesByTarget, edgesBySource } = buildEdgeMaps(edges);

  const context: ConversionContext = {
    nodes: nodeMap,
    edges,
    edgesByTarget,
    edgesBySource,
    nodeExpressions: new Map(),
    variableNodes: new Set(),
    visited: new Set(),
    customFunctions: new Map(),
  };

  // Find Start node
  const startNode = findStartNode(context);

  // Identify which nodes should create variables
  for (const node of nodes) {
    if (shouldCreateVariable(node, context)) {
      context.variableNodes.add(node.id);
    }
  }

  // Generate function declarations
  const functionDecls = generateFunctionDeclarations(startNode, context, generateNodeExpression);

  // Generate main expression
  const mainExpression = buildMainExpression(startNode, context);

  // Combine with proper formatting
  if (functionDecls.length > 0) {
    // Function declarations, blank line, then main expression
    return functionDecls.join('\n\n') + '\n\n' + mainExpression;
  }

  return mainExpression;
}
