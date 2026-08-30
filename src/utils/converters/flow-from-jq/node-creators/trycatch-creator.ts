/**
 * @fileoverview Creates TryCatch nodes with try/catch branch connections.
 */

import { type JQNode } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext, type ASTNode } from '../types';
import { generateNodeId, createEdge } from './utils';

/**
 * Creates a TryCatch node with try and optional catch connections.
 *
 * @param tryExpr - The try branch AST node
 * @param catchExpr - Optional catch branch AST node
 * @param context - Conversion context
 * @param convertASTNode - Function to convert AST nodes to visual nodes
 * @returns The created node ID
 */
export function createTryCatchNode(
  tryExpr: ASTNode,
  catchExpr: ASTNode | undefined,
  context: ConversionContext,
  convertASTNode: (node: ASTNode, ctx: ConversionContext) => string,
): string {
  const nodeId = generateNodeId(context);

  const node: JQNode = {
    id: nodeId,
    type: JQNodeType.TryCatch,
    position: { x: 0, y: 0 },
    data: {
      type: JQNodeType.TryCatch,
    },
  };

  context.nodes.push(node);

  // Create try connection
  const tryNodeId = convertASTNode(tryExpr, context);
  createEdge(nodeId, tryNodeId, JQHandleIdPrefix.Try, JQHandleIdPrefix.Top, context);

  // Create catch connection if present
  if (catchExpr) {
    const catchNodeId = convertASTNode(catchExpr, context);
    createEdge(nodeId, catchNodeId, JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top, context);
  }

  return nodeId;
}
