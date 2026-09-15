/**
 * @fileoverview Creates the node an `expr as $name` assignment binds to.
 */

import { type ASTAssignmentNode, type ASTNode, type ConversionContext } from '../types';

/** Converts a child AST node and returns its visual node id. */
type ConvertFn = (astNode: ASTNode, context: ConversionContext) => string;

/**
 * Creates the expression node and registers it under the assignment's variable
 * name, keeping the name on the node for round-trip fidelity.
 *
 * @param astNode - The Assignment AST node
 * @param context - Conversion context
 * @param convert - Converts the bound value's AST node
 * @returns The created node ID
 */
export function createAssignmentNode(
  astNode: ASTAssignmentNode,
  context: ConversionContext,
  convert: ConvertFn,
): string {
  const exprNodeId = convert(astNode.value, context);
  context.variableMap.set(astNode.variable, exprNodeId);
  // Preserve the original variable name for round-trip fidelity
  const node = context.nodes.find((n) => n.id === exprNodeId);
  if (node) {
    node.data.name = astNode.variable;
  }
  return exprNodeId;
}
