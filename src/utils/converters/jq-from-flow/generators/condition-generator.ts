/**
 * @fileoverview Condition expression generator.
 *
 * Supports sub-flow chains in condition branches: each branch (if/then/elif/else)
 * can connect to a chain of nodes via bottom handles, producing piped expressions.
 */

import { type JQNode, type JQConditionData } from '../../../../types';
import { JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext } from '../types';
import { makeIndent } from '../utils/formatter';
import { edgeTargetNode } from '../utils/validators';
import { buildBranchChainExpression, type NodeExpressionFn } from './branch-chain-builder';

/**
 * Generates a jq expression for a Condition node.
 *
 * Creates if/elif/else conditional expressions. Each branch supports
 * sub-flow chains — nodes connected via bottom handles are piped together.
 *
 * @param node - The Condition node
 * @param context - Conversion context
 * @param nodeExpressionFn - Function to generate expressions for child nodes
 * @param indent - Current indentation level (default 0)
 * @returns The jq expression string
 * @throws {Error} If required branch connections are missing
 * @throws {Error} If no branches are defined
 */
export function generateConditionExpression(
  node: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent = 0,
): string {
  const data = node.data as JQConditionData;
  const branches = data.branches;

  if (branches.length === 0) {
    throw new Error(`Condition node ${node.id} has no branches`);
  }

  const outgoingEdges = context.edgesBySource.get(node.id) ?? [];
  const innerIndent = makeIndent(indent + 1);
  const outerIndent = makeIndent(indent);

  const lines: string[] = [];

  // Process each branch (if/elif)
  for (let i = 0; i < branches.length; i++) {
    const ifEdge = outgoingEdges.find(
      (e) => e.sourceHandle === `${JQHandleIdPrefix.If}:${String(i)}`,
    );
    const thenEdge = outgoingEdges.find(
      (e) => e.sourceHandle === `${JQHandleIdPrefix.Then}:${String(i)}`,
    );

    if (!ifEdge || !thenEdge) {
      throw new Error(
        `Condition node ${node.id} missing if/then connections for branch ${String(i)}`,
      );
    }

    // Generate chain expressions (follows bottom handles for sub-flow chains)
    const ifExpr = buildBranchChainExpression(
      edgeTargetNode(context, ifEdge),
      context,
      nodeExpressionFn,
      indent + 1,
    );
    const thenExpr = buildBranchChainExpression(
      edgeTargetNode(context, thenEdge),
      context,
      nodeExpressionFn,
      indent + 1,
    );

    const keyword = i === 0 ? 'if' : 'elif';
    lines.push(`${outerIndent}${keyword} ${ifExpr} then`);
    lines.push(`${innerIndent}${thenExpr}`);
  }

  // Process else branch
  const elseEdge = outgoingEdges.find((e) => e.sourceHandle === JQHandleIdPrefix.Else);
  if (elseEdge) {
    const elseExpr = buildBranchChainExpression(
      edgeTargetNode(context, elseEdge),
      context,
      nodeExpressionFn,
      indent + 1,
    );
    lines.push(`${outerIndent}else`);
    lines.push(`${innerIndent}${elseExpr}`);
  }

  lines.push(`${outerIndent}end`);

  return lines.join('\n');
}
