/**
 * @fileoverview Creates Condition nodes with if/then/else branch connections.
 */

import { type JQNode } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext, type ASTNode } from '../types';
import { generateNodeId, createEdge } from './utils';

/**
 * Creates a Condition node with if/then/else branch connections.
 *
 * @param branches - Array of if/elif condition-result pairs
 * @param elseBranch - Optional else branch AST node
 * @param context - Conversion context
 * @param convertASTNode - Function to convert AST nodes to visual nodes
 * @returns The created node ID
 */
export function createConditionalNode(
  branches: { condition: ASTNode; then: ASTNode }[],
  elseBranch: ASTNode | undefined,
  context: ConversionContext,
  convertASTNode: (node: ASTNode, ctx: ConversionContext) => string,
): string {
  const nodeId = generateNodeId(context);

  const node: JQNode = {
    id: nodeId,
    type: JQNodeType.Condition,
    position: { x: 0, y: 0 },
    data: {
      type: JQNodeType.Condition,
      branches: branches.map((_, index) => ({ id: `branch_${String(index)}` })),
    },
  };

  context.nodes.push(node);

  // Create if/then connections for each branch
  branches.forEach((branch, index) => {
    const condNodeId = convertASTNode(branch.condition, context);
    const thenNodeId = convertASTNode(branch.then, context);

    createEdge(
      nodeId,
      condNodeId,
      `${JQHandleIdPrefix.If}:${String(index)}`,
      JQHandleIdPrefix.Top,
      context,
    );
    createEdge(
      nodeId,
      thenNodeId,
      `${JQHandleIdPrefix.Then}:${String(index)}`,
      JQHandleIdPrefix.Top,
      context,
    );
  });

  // Create else connection if present
  if (elseBranch) {
    const elseNodeId = convertASTNode(elseBranch, context);
    createEdge(nodeId, elseNodeId, JQHandleIdPrefix.Else, JQHandleIdPrefix.Top, context);
  }

  return nodeId;
}
