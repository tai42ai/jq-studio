/**
 * @fileoverview TryCatch expression generator.
 *
 * Generates `try EXPR` or `try EXPR catch EXPR` expressions.
 * Each branch (try/catch) can connect to a chain of nodes via bottom handles.
 */

import { type JQNode } from '../../../../types';
import { JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext } from '../types';
import { asTerm } from '../expression-builder';
import { edgeTargetNode } from '../utils/validators';
import { buildBranchChainExpression, type NodeExpressionFn } from './branch-chain-builder';

/**
 * Generates a jq expression for a TryCatch node.
 *
 * Each branch is embedded via `asTerm` (see its doc for the binding rule).
 *
 * @param node - The TryCatch node
 * @param context - Conversion context
 * @param nodeExpressionFn - Function to generate expressions for child nodes
 * @param indent - Current indentation level (default 0)
 * @returns The jq expression string
 * @throws {Error} If the try connection is missing
 */
export function generateTryCatchExpression(
  node: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent = 0,
): string {
  const outgoingEdges = context.edgesBySource.get(node.id) ?? [];

  // Try handle must be connected
  const tryEdge = outgoingEdges.find((e) => e.sourceHandle === JQHandleIdPrefix.Try);
  if (!tryEdge) {
    throw new Error(`TryCatch node ${node.id} missing try connection`);
  }

  const tryNode = edgeTargetNode(context, tryEdge);
  const tryBody = asTerm(buildBranchChainExpression(tryNode, context, nodeExpressionFn, indent));

  // Catch handle is optional
  const catchEdge = outgoingEdges.find((e) => e.sourceHandle === JQHandleIdPrefix.Catch);
  if (catchEdge) {
    const catchNode = edgeTargetNode(context, catchEdge);
    const catchExpr = buildBranchChainExpression(catchNode, context, nodeExpressionFn, indent);
    return `try ${tryBody} catch ${asTerm(catchExpr)}`;
  }

  return `try ${tryBody}`;
}
