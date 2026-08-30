/**
 * @fileoverview Main node expression generator (dispatcher).
 */

import { type JQNode } from '../../../../types';
import { JQNodeType } from '../../../../enums';
import { type ConversionContext } from '../types';
import { generateValueExpression } from './value-generator';
import { generateFunctionCallExpression } from './function-generator';
import { generateOperatorExpression } from './operator-generator';
import { generateConditionExpression } from './condition-generator';
import { generateTryCatchExpression } from './trycatch-generator';

/**
 * Generates a jq expression for any node based on its type.
 *
 * This function dispatches to type-specific generators and caches results.
 *
 * @param node - The node to generate an expression for
 * @param context - Conversion context
 * @param indent - Current indentation level (default 0)
 * @returns The jq expression string
 * @throws {Error} If the node type is unsupported or invalid
 */
export function generateNodeExpression(
  node: JQNode,
  context: ConversionContext,
  indent = 0,
): string {
  // Check cache first
  const cachedExpr = context.nodeExpressions.get(node.id);
  if (cachedExpr !== undefined) {
    return cachedExpr;
  }

  // Check for cycles
  if (context.visited.has(node.id)) {
    throw new Error(`Circular dependency detected at node ${node.id}`);
  }
  context.visited.add(node.id);

  let expression: string;

  switch (node.data.type) {
    case JQNodeType.Value:
      expression = generateValueExpression(node, context, generateNodeExpression, indent);
      break;

    case JQNodeType.FunctionCall:
      expression = generateFunctionCallExpression(node, context, generateNodeExpression, indent);
      break;

    case JQNodeType.Operator:
      expression = generateOperatorExpression(node, context, generateNodeExpression, indent);
      break;

    case JQNodeType.Condition:
      expression = generateConditionExpression(node, context, generateNodeExpression, indent);
      break;

    case JQNodeType.TryCatch:
      expression = generateTryCatchExpression(node, context, generateNodeExpression, indent);
      break;

    case JQNodeType.Start:
      // Start node doesn't generate an expression
      expression = '.';
      break;

    case JQNodeType.FunctionDecl:
      throw new Error(`FunctionDecl node ${node.id} should not be in main expression chain`);

    default:
      throw new Error(`Unsupported node type: ${node.data.type} in node ${node.id}`);
  }

  // Cache and return
  context.nodeExpressions.set(node.id, expression);
  context.visited.delete(node.id); // Allow node to be visited again in different branches
  return expression;
}
