/**
 * @fileoverview Operator expression parser.
 *
 * Handles binary and unary ('not', '?') operators.
 */

import { type ASTOperatorNode, type ASTNode } from '../types';
import { findTopLevelOperator } from './utils';
import { isUnrepresentableOperand } from '../pipe-utils';

/** Signature of the recursive expression parser passed in to avoid a circular import. */
type ParseExpressionFn = (expression: string) => ASTNode;

/**
 * An operator wires each side to a single source node whose bottom chain the
 * serialiser re-inlines. A pipe operand of simple terms round-trips through that
 * walk, but one whose stages include an operator, conditional, try/catch, or
 * array/object/assignment strands its tail OUTSIDE the operator on the way back —
 * the silent corruption of e.g. `((.a // {}) | .b) // []`. Such an operand has no
 * faithful graph, so refuse it here (honest PARSE-FAIL) and let the surface fall
 * back to the "edit as text" notice instead of drawing a wrong, corrupting graph.
 */
function assertRepresentableOperand(operand: ASTNode, source: string): ASTNode {
  if (isUnrepresentableOperand(operand)) {
    throw new Error(`Unable to parse jq expression: ${source.trim()}`);
  }
  return operand;
}

/**
 * Tries to parse a binary operator expression.
 *
 * Handles unary operators 'not' and '?' in addition to binary operators.
 *
 * Operators are checked in order of precedence (lowest to highest):
 * - or, and (logical)
 * - // (alternative)
 * - ==, !=, <=, >=, <, > (comparison)
 * - +, - (addition/subtraction)
 * - *, /, % (multiplication/division)
 *
 * Unary operators:
 * - not (prefix unary)
 * - ? (postfix unary)
 *
 * @param str - Expression string
 * @param parseFn - Function to parse child expressions
 * @returns Operator AST node or null if not an operator expression
 *
 * @example
 * tryParseOperator("not .active"); // Returns: { type: 'Operator', operator: 'not', ... }
 * tryParseOperator(".data?"); // Returns: { type: 'Operator', operator: '?', ... }
 * tryParseOperator("a + b"); // Returns: { type: 'Operator', operator: '+', left: ..., right: ... }
 */
export function tryParseOperator(str: string, parseFn: ParseExpressionFn): ASTOperatorNode | null {
  const trimmed = str.trim();

  // Check for unary 'not' operator (prefix)
  if (trimmed.startsWith('not ')) {
    const operand = trimmed.substring(4).trim();
    return {
      type: 'Operator',
      operator: 'not',
      left: assertRepresentableOperand(parseFn(operand), operand),
      // For unary operators, right is a placeholder (identity)
      right: { type: 'Identity', value: '.' },
    };
  }

  // Check for unary '?' operator (postfix)
  if (trimmed.endsWith('?') && !trimmed.endsWith('\\?')) {
    const operand = trimmed.substring(0, trimmed.length - 1).trim();
    return {
      type: 'Operator',
      operator: '?',
      left: assertRepresentableOperand(parseFn(operand), operand),
      // For unary operators, right is a placeholder (identity)
      right: { type: 'Identity', value: '.' },
    };
  }

  // Binary operators in order of precedence (lowest to highest)
  const operators = ['or', 'and', '//', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%'];

  for (const op of operators) {
    const opIndex = findTopLevelOperator(trimmed, op);
    if (opIndex !== -1) {
      // Skip if operator is at start and is +/- (likely a number literal like -42)
      if (opIndex === 0 && (op === '+' || op === '-')) {
        continue;
      }

      const leftSource = trimmed.substring(0, opIndex).trim();
      const rightSource = trimmed.substring(opIndex + op.length).trim();
      return {
        type: 'Operator',
        operator: op,
        left: assertRepresentableOperand(parseFn(leftSource), leftSource),
        right: assertRepresentableOperand(parseFn(rightSource), rightSource),
      };
    }
  }

  return null;
}
