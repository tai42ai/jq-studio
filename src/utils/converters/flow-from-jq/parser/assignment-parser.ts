/**
 * @fileoverview Parses a jq variable assignment — `expr as $name`.
 */

import { type ASTNode } from '../types';
import { assignmentNameSplitsOperand } from '../pipe-utils';

/** Signature of the recursive expression parser passed in to avoid a circular import. */
type ParseExpressionFn = (expression: string) => ASTNode;

/**
 * Parses an `expr as $name` binding, or returns null when the text is not one.
 *
 * @param trimmed - Trimmed expression text with no top-level pipe
 * @param parse - The recursive expression parser, for the bound value
 * @returns The assignment AST node, or null when the text is not an assignment
 * @throws {Error} If the bound value is one the name cannot bind whole, which has
 *   no faithful drawing
 */
export function parseAssignment(trimmed: string, parse: ParseExpressionFn): ASTNode | null {
  const asMatch = /^(.+?)\s+as\s+\$(\w+)$/.exec(trimmed);
  if (!asMatch) return null;

  const value = parse(asMatch[1] ?? '');
  // A value the name cannot bind whole has no faithful drawing — refuse it
  // rather than draw a graph that rebinds the variable to a fragment.
  if (assignmentNameSplitsOperand(value)) {
    throw new Error(`Unable to parse jq expression: ${trimmed}`);
  }

  return {
    type: 'Assignment',
    value,
    variable: asMatch[2] ?? '',
  };
}
