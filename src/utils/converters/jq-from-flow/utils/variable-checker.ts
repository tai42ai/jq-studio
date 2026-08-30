/**
 * @fileoverview Variable creation logic for expression chain nodes.
 * Extracted to a utility to avoid circular dependencies between
 * expression-builder and generators.
 *
 * Variable creation is name-based: nodes with a name create variables,
 * nodes without a name just pass their expression through the pipeline.
 */

import { type JQNode } from '../../../../types';
import { JQNodeType } from '../../../../enums';
import { type ConversionContext } from '../types';

/**
 * Determines if a node should create a variable in the expression chain.
 *
 * Rules:
 * - Nodes create variables when they have a non-empty name
 * - Operator and Condition nodes NEVER create variables (always inline)
 * - Start and FunctionDecl nodes NEVER create variables
 *
 * @param node - The node to check
 * @param context - Conversion context with edge information
 * @returns true if the node should create a variable
 */
export function shouldCreateVariable(node: JQNode, _context: ConversionContext): boolean {
  const nodeType = node.data.type;

  // Operator, Condition, and TryCatch nodes never create variables (always inline)
  if (
    nodeType === JQNodeType.Operator ||
    nodeType === JQNodeType.Condition ||
    nodeType === JQNodeType.TryCatch
  ) {
    return false;
  }

  // Start, FunctionDecl, and Comment nodes never create variables
  if (
    nodeType === JQNodeType.Start ||
    nodeType === JQNodeType.FunctionDecl ||
    nodeType === JQNodeType.Comment
  ) {
    return false;
  }

  // Name-based: nodes with a name create variables
  return !!node.data.name;
}
