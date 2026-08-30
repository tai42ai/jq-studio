/**
 * @fileoverview Try-catch expression parser.
 *
 * Parses `try EXPR` and `try EXPR catch EXPR` constructs.
 */

import { type ASTTryCatchNode, type ASTNode } from '../types';
import { findTopLevelKeyword } from './conditional-parser';

/** Signature of the recursive expression parser passed in to avoid a circular import. */
type ParseExpressionFn = (expression: string) => ASTNode;

/**
 * Parses a try-catch expression.
 *
 * @param str - Try-catch expression string (must start with 'try ')
 * @param parseFn - Function to parse child expressions
 * @returns TryCatch AST node
 *
 * @example
 * parseTryCatch('try .x catch "default"', parseJQExpression);
 * // Returns { type: 'TryCatch', tryExpr: Path(.x), catchExpr: String("default") }
 */
export function parseTryCatch(str: string, parseFn: ParseExpressionFn): ASTTryCatchNode {
  // Remove 'try ' prefix (4 chars)
  const content = str.substring(4).trim();

  // Find top-level 'catch' keyword
  const catchPos = findTopLevelKeyword(content, 'catch');

  if (catchPos !== -1) {
    const tryExprStr = content.substring(0, catchPos).trim();
    const catchExprStr = content.substring(catchPos + 5).trim(); // 'catch' is 5 chars

    return {
      type: 'TryCatch',
      tryExpr: parseFn(tryExprStr),
      catchExpr: parseFn(catchExprStr),
    };
  }

  return {
    type: 'TryCatch',
    tryExpr: parseFn(content),
  };
}
