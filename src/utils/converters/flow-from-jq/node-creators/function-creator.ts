/**
 * @fileoverview Creates FunctionCall nodes with parameter connections.
 */

import { type JQNode } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext, type ASTNode } from '../types';
import { type FunctionDef, functionCategories } from '../../../function-registry';
import { generateNodeId, createEdge } from './utils';

/**
 * Looks up a built-in function by name.
 *
 * @param functionName - Name of the function to look up
 * @param context - Conversion context with function registry
 * @returns Function definition if found, null otherwise
 */
function lookupBuiltInFunction(
  functionName: string,
  context: ConversionContext,
): FunctionDef | null {
  return context.builtInFunctions.get(functionName) ?? null;
}

/**
 * Creates a FunctionCall node.
 *
 * @param functionName - Name of the function
 * @param args - Array of argument AST nodes
 * @param context - Conversion context
 * @param convertASTNode - Function to convert AST nodes to visual nodes
 * @returns The created node ID
 */
export function createFunctionCallNode(
  functionName: string,
  args: ASTNode[],
  context: ConversionContext,
  convertASTNode: (node: ASTNode, ctx: ConversionContext) => string,
): string {
  const nodeId = generateNodeId(context);

  // Determine call type (builtin vs custom)
  const builtInFunc = lookupBuiltInFunction(functionName, context);
  let callType = 'builtin';

  if (builtInFunc) {
    // Find which category this function belongs to
    for (const category of functionCategories) {
      if (category.functions.some((f) => f.id === builtInFunc.id)) {
        callType = category.id;
        break;
      }
    }
  } else if (context.functionDefinitions.has(functionName)) {
    callType = 'custom';
  }

  const node: JQNode = {
    id: nodeId,
    type: JQNodeType.FunctionCall,
    position: { x: 0, y: 0 }, // Will be positioned later
    data: {
      type: JQNodeType.FunctionCall,
      callType,
      selectedFunction: functionName,
    },
  };

  context.nodes.push(node);

  // Create parameter connections
  args.forEach((arg, index) => {
    const argNodeId = convertASTNode(arg, context);
    createEdge(
      nodeId,
      argNodeId,
      `${JQHandleIdPrefix.Param}:${String(index)}`,
      JQHandleIdPrefix.Top,
      context,
    );
  });

  return nodeId;
}
