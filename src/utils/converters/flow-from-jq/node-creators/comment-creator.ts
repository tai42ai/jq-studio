/**
 * @fileoverview Creates a Comment node from a Comment AST node.
 */

import { JQNodeType } from '../../../../enums';
import { type JQNode } from '../../../../types';
import { type ASTCommentNode, type ConversionContext } from '../types';
import { generateNodeId } from './utils';

/**
 * Creates a Comment node carrying the comment's text.
 *
 * @param astNode - The Comment AST node
 * @param context - Conversion context
 * @returns The created node ID
 */
export function createCommentNode(astNode: ASTCommentNode, context: ConversionContext): string {
  const commentNodeId = generateNodeId(context);
  const commentNode: JQNode = {
    id: commentNodeId,
    type: JQNodeType.Comment,
    position: { x: 0, y: 0 },
    data: {
      type: JQNodeType.Comment,
      text: astNode.text,
    },
  };
  context.nodes.push(commentNode);
  return commentNodeId;
}
