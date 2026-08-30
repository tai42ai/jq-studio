/**
 * @fileoverview Operator expression generator.
 */

import { type JQNode, type JQEdge, type JQOperatorData } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext } from '../types';
import { classifyEdge } from '../utils/edge-classifier';
import { enterChainNode, edgeSourceNode, edgeTargetNode } from '../utils/validators';
import {
  type ExpressionPart,
  asTerm,
  commentParts,
  joinExpressionParts,
} from '../expression-builder';
import { type NodeExpressionFn } from './branch-chain-builder';

/**
 * Generates a jq expression for an Operator node.
 *
 * Operators are always binary (two operands) and appear inline.
 *
 * @param node - The Operator node
 * @param context - Conversion context
 * @param nodeExpressionFn - Function to generate expressions for child nodes
 * @param indent - Current indentation level (default 0)
 * @returns The jq expression string
 * @throws {Error} If operands are missing
 */
export function generateOperatorExpression(
  node: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent = 0,
): string {
  const data = node.data as JQOperatorData;
  const operator = data.operator;

  // Find incoming edges to operator's LEFT and RIGHT handles
  const incomingEdges = context.edgesByTarget.get(node.id) ?? [];

  // Left operand comes TO operator's LEFT handle
  const leftEdge = incomingEdges.find((e) =>
    e.targetHandle?.startsWith(JQHandleIdPrefix.OperatorLeft),
  );

  if (!leftEdge) {
    throw new Error(`Operator node ${node.id} missing left operand connection (left handle)`);
  }

  const leftNode = edgeSourceNode(context, leftEdge);

  // Right operand comes TO operator's RIGHT handle
  const rightEdge = incomingEdges.find((e) =>
    e.targetHandle?.startsWith(JQHandleIdPrefix.OperatorRight),
  );

  if (!rightEdge) {
    throw new Error(`Operator node ${node.id} missing right operand connection (right handle)`);
  }

  const rightNode = edgeSourceNode(context, rightEdge);

  // Generate operand expressions.
  // For nested operators (e.g. .x >= 1 and .x <= 10), an operand value node
  // may connect to multiple operators. We need to generate the inner operator's
  // expression, not the raw value. Inner operators are created first (depth-first),
  // so the edge just before this operator's edge is the correct inner operator.
  const leftExpr = resolveOperandExpression(
    leftNode,
    leftEdge,
    node.id,
    context,
    nodeExpressionFn,
    indent,
  );
  const rightExpr = resolveOperandExpression(
    rightNode,
    rightEdge,
    node.id,
    context,
    nodeExpressionFn,
    indent,
  );

  // Handle unary operators (created by flow-from-jq parser with dummy Identity right operand).
  // `not` reads its input through a pipe, whose left side takes any expression; `?` is
  // postfix on the term to its left, so its operand is embedded like a binary one.
  if (operator === 'not') {
    return `(${leftExpr} | not)`;
  }
  if (operator === '?') {
    return `${asTerm(leftExpr)}?`;
  }

  // Both operands are embedded as terms, and the operator's own expression is
  // parenthesised so it is one wherever it lands in turn.
  return `(${asTerm(leftExpr)} ${operator} ${asTerm(rightExpr)})`;
}

/**
 * Resolves the expression for an operator's operand.
 *
 * When a value node connects to multiple operators (nested operators like >= and),
 * this function finds the inner operator whose expression should be used instead
 * of the raw value.
 *
 * For 2-deep chains (e.g. >= and), the direct inner is found via edge indices.
 * For 3+ deep chains, the direct inner may have containing operators that are
 * still inner to the current operator. These are found by following the operator
 * result chain through right operands.
 *
 * @throws {Error} If an operand reaches an operator over an edge that is not one of that
 *   operand's operator edges, leaving the nesting order unreadable
 */
function resolveOperandExpression(
  operandNode: JQNode,
  operandEdge: JQEdge,
  currentOperatorId: string,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent: number,
): string {
  const outgoing = context.edgesBySource.get(operandNode.id) ?? [];
  const operatorEdges = outgoing.filter(
    (e) =>
      (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
      (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
  );

  // Nesting order is read off this list — an operand edge missing from it would be
  // misread as innermost, dropping every operator the list holds.
  const currentIdx = operatorEdges.findIndex((e) => e.target === currentOperatorId);
  if (currentIdx < 0) {
    throw new Error(
      `Operator node ${currentOperatorId} operand ${operandNode.id} reaches it over edge ` +
        `${operandEdge.id}, which is not one of that node's operator edges ` +
        `(${operatorEdges.map((e) => e.id).join(', ') || 'none'}) — ` +
        'reconnect the operand from an operator handle',
    );
  }
  if (currentIdx === 0) {
    // Current is innermost — nothing is nested inside it, so the operand contributes its
    // own value (with any pipe chain)
    return buildOperandWithPipeChain(operandNode, context, nodeExpressionFn, indent);
  }

  // Direct inner operator is the one just before the current in creation order.
  // `currentIdx` comes from a findIndex hit above 0, so the preceding index is in range.
  const innerEdge = operatorEdges[currentIdx - 1];
  if (!innerEdge) {
    throw new Error(
      `Operator node ${currentOperatorId} operand ${operandNode.id} lists no operator edge at ` +
        `index ${String(currentIdx - 1)} of ${String(operatorEdges.length)}`,
    );
  }

  const directInnerOp = edgeTargetNode(context, innerEdge);

  // For 3+ deep chains, follow the operator result chain through right operands
  // to find the outermost operator that's still inner to the current one.
  // Each operator's right operand may connect to a "containing" operator at a
  // higher edge index, forming the chain: inner → containing → ... → current.
  let result = directInnerOp;
  for (;;) {
    // Find result's right operand (incoming edge to OperatorRight handle)
    const incoming = context.edgesByTarget.get(result.id) ?? [];
    const rightEdge = incoming.find((e) =>
      e.targetHandle?.startsWith(JQHandleIdPrefix.OperatorRight),
    );
    if (!rightEdge) break;

    const rightOperandOutgoing = context.edgesBySource.get(rightEdge.source) ?? [];
    const rightOpEdges = rightOperandOutgoing.filter(
      (e) =>
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
    );

    // A `result` edge missing from this list would start the containment search at
    // index 0 and misread an operator nested INSIDE `result` as containing it.
    const resultIdx = rightOpEdges.findIndex((e) => e.target === result.id);
    if (resultIdx < 0) {
      throw new Error(
        `Operator node ${result.id} right operand ${rightEdge.source} reaches it over edge ` +
          `${rightEdge.id}, which is not one of that node's operator edges ` +
          `(${rightOpEdges.map((e) => e.id).join(', ') || 'none'}) — ` +
          'reconnect the operand from an operator handle',
      );
    }

    // Look for a containing operator at a higher index (excluding the current outer)
    let nextOp: JQNode | null = null;
    for (let i = resultIdx + 1; i < rightOpEdges.length; i++) {
      const roe = rightOpEdges[i];
      if (roe && roe.target !== currentOperatorId) {
        nextOp = edgeTargetNode(context, roe);
        break;
      }
    }
    if (!nextOp) break;
    result = nextOp;
  }

  return nodeExpressionFn(result, context, indent);
}

/**
 * Appends a chain node's contribution to an operand's parts: one comment part
 * per non-blank line for a Comment node, otherwise the node's own expression.
 */
function pushOperandPart(
  parts: ExpressionPart[],
  node: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent: number,
): void {
  if (node.data.type === JQNodeType.Comment) {
    parts.push(...commentParts(node.data.text));
    return;
  }
  parts.push({ type: 'expression', text: nodeExpressionFn(node, context, indent) });
}

/**
 * Follows bottom-handle pipe chain from a node, collecting piped expressions.
 * Stops when the next node has its own operator edges (to avoid consuming
 * nodes belonging to a different operator chain).
 *
 * A Comment node in the chain contributes `# text` lines rather than an
 * expression, joined by the shared inline join so the comment terminates its own
 * line — a space-separated join would comment out the rest of the operand.
 * A chain that is nothing but comments has no value for the operator to read.
 *
 * The chain is returned as it joins; the operator embeds it as a term.
 *
 * @throws {Error} If the chain consists of Comment nodes only
 * @throws {Error} If the chain loops back on a node it already passed through
 */
function buildOperandWithPipeChain(
  node: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent: number,
): string {
  const parts: ExpressionPart[] = [];
  pushOperandPart(parts, node, context, nodeExpressionFn, indent);

  // Named nodes create `as $var` — their bottom edge is the main chain
  // continuation after the variable assignment, not part of the operand.
  if (node.data.name) {
    return joinExpressionParts(parts, node.id, true);
  }

  // Edge creation order check: if the entry node's bottom edge appears after
  // all operator edges, it was created by an outer Pipe AFTER the operator,
  // meaning it's the main chain continuation — not part of the operand.
  const entryOutgoing = context.edgesBySource.get(node.id) ?? [];
  const entryBottomEdge = entryOutgoing.find((e) => classifyEdge(e).isBottomHandle);
  if (entryBottomEdge) {
    const opEdges = entryOutgoing.filter(
      (e) =>
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
    );
    if (opEdges.length > 0) {
      const bottomIdx = entryOutgoing.indexOf(entryBottomEdge);
      const lastOpIdx = Math.max(...opEdges.map((e) => entryOutgoing.indexOf(e)));
      if (bottomIdx > lastOpIdx) {
        return joinExpressionParts(parts, node.id, true);
      }
    }
  }

  const visited = new Set<string>([node.id]);
  let current = node;

  for (;;) {
    const outgoing = context.edgesBySource.get(current.id) ?? [];
    const bottomEdge = outgoing.find((e) => classifyEdge(e).isBottomHandle);
    if (!bottomEdge) break;

    const nextNode = edgeTargetNode(context, bottomEdge);

    // Stop if next node has its own operator connections
    const nextOutgoing = context.edgesBySource.get(nextNode.id) ?? [];
    const nextHasOpEdge = nextOutgoing.some(
      (e) =>
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
    );
    if (nextHasOpEdge) break;

    enterChainNode(visited, nextNode, bottomEdge);
    pushOperandPart(parts, nextNode, context, nodeExpressionFn, indent);
    current = nextNode;
  }

  return joinExpressionParts(parts, node.id, true);
}
