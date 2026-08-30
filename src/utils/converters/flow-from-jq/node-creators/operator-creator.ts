/**
 * @fileoverview Creates Operator nodes with left and right operand connections.
 */

import { type JQNode } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext, type ASTNode } from '../types';
import { generateNodeId, createEdge } from './utils';

/**
 * Creates an Operator node with left and right operand connections.
 *
 * @param operator - The operator symbol
 * @param left - Left operand AST node
 * @param right - Right operand AST node
 * @param context - Conversion context
 * @param convertASTNode - Function to convert AST nodes to visual nodes
 * @returns The created node ID
 */
export function createOperatorNode(
  operator: string,
  left: ASTNode,
  right: ASTNode,
  context: ConversionContext,
  convertASTNode: (node: ASTNode, ctx: ConversionContext) => string,
): string {
  const nodeId = generateNodeId(context);

  const node: JQNode = {
    id: nodeId,
    type: JQNodeType.Operator,
    position: { x: 0, y: 0 },
    data: {
      type: JQNodeType.Operator,
      operator,
    },
  };

  context.nodes.push(node);

  // Left operand connects: Value.right → Operator.left
  // For nested operators, connect from the inner operator's right value node
  // to avoid source handle collisions on the shared left value node.
  const leftNodeId = convertASTNode(left, context);
  const effectiveLeftSource = context.operatorResultMap.get(leftNodeId) ?? leftNodeId;
  createEdge(
    effectiveLeftSource,
    nodeId,
    `${JQHandleIdPrefix.OperatorRight}:${effectiveLeftSource}`,
    JQHandleIdPrefix.OperatorLeft,
    context,
  );

  // Right operand connects: Value.left → Operator.right (no mapping for right)
  const rightNodeId = convertASTNode(right, context);
  createEdge(
    rightNodeId,
    nodeId,
    `${JQHandleIdPrefix.OperatorLeft}:${rightNodeId}`,
    JQHandleIdPrefix.OperatorRight,
    context,
  );

  // Track: this operator's chain entry maps to its right value node
  context.operatorResultMap.set(leftNodeId, rightNodeId);

  // Return left operand as the entry point of the operator chain.
  // The operator node has no top/bottom handles — it only connects
  // via side handles. The left operand serves as the flow entry point.
  return leftNodeId;
}
