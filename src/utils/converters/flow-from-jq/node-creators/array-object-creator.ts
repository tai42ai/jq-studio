/**
 * @fileoverview Creates Array and Object Value nodes with item/field connections.
 */

import { type JQNode } from '../../../../types';
import { JQNodeType, ValueType, JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext, type ASTNode } from '../types';
import { generateNodeId, createEdge } from './utils';

/**
 * Creates an Array Value node with item connections.
 *
 * @param elements - Array element AST nodes
 * @param context - Conversion context
 * @param convertASTNode - Function to convert AST nodes to visual nodes
 * @returns The created node ID
 */
export function createArrayNode(
  elements: ASTNode[],
  context: ConversionContext,
  convertASTNode: (node: ASTNode, ctx: ConversionContext) => string,
): string {
  const nodeId = generateNodeId(context);

  const node: JQNode = {
    id: nodeId,
    type: JQNodeType.Value,
    position: { x: 0, y: 0 },
    data: {
      type: JQNodeType.Value,
      valueType: ValueType.Array,
      items: elements.map((_, index) => ({ id: `item_${String(index)}` })),
    },
  };

  context.nodes.push(node);

  // Create item connections
  elements.forEach((elem, index) => {
    const elemNodeId = convertASTNode(elem, context);
    createEdge(
      nodeId,
      elemNodeId,
      `${JQHandleIdPrefix.Item}:item_${String(index)}`,
      JQHandleIdPrefix.Top,
      context,
    );
  });

  return nodeId;
}

/**
 * Creates an Object Value node with field connections.
 *
 * @param fields - Object field definitions
 * @param context - Conversion context
 * @param convertASTNode - Function to convert AST nodes to visual nodes
 * @returns The created node ID
 */
export function createObjectNode(
  fields: { key: string; value: ASTNode }[],
  context: ConversionContext,
  convertASTNode: (node: ASTNode, ctx: ConversionContext) => string,
): string {
  const nodeId = generateNodeId(context);

  const node: JQNode = {
    id: nodeId,
    type: JQNodeType.Value,
    position: { x: 0, y: 0 },
    data: {
      type: JQNodeType.Value,
      valueType: ValueType.Object,
      fields: fields.map((field, index) => ({
        id: `field_${String(index)}`,
        name: field.key,
      })),
    },
  };

  context.nodes.push(node);

  // Create field value connections
  fields.forEach((field, index) => {
    const valueNodeId = convertASTNode(field.value, context);
    createEdge(
      nodeId,
      valueNodeId,
      `${JQHandleIdPrefix.Field}:field_${String(index)}`,
      JQHandleIdPrefix.Top,
      context,
    );
  });

  return nodeId;
}
