/**
 * @fileoverview Parses a jq function call — `name` or `name(arg1; arg2; …)`.
 */

import { type ASTNode } from '../types';
import { splitTopLevel } from './top-level-scan';

/** Signature of the recursive expression parser passed in to avoid a circular import. */
type ParseExpressionFn = (expression: string) => ASTNode;

/** Bare words that are literals, not filter invocations. */
const JQ_KEYWORDS = new Set(['true', 'false', 'null']);

/**
 * Parses a function call, or returns null when the text is not one.
 *
 * In jq, any bare identifier is a valid filter invocation — including function
 * parameters (e.g., `f` in `def double(f): f * 2;`). The text is a call when it
 * carries parentheses, or when it is a bare identifier starting with a letter or
 * underscore that is not a literal keyword.
 *
 * @param trimmed - Trimmed expression text with no top-level pipe
 * @param parse - The recursive expression parser, for the arguments
 * @returns The function-call AST node, or null when the text is not a call
 */
export function parseFunctionCall(trimmed: string, parse: ParseExpressionFn): ASTNode | null {
  const funcMatch = /^(\w+)(?:\((.*)\))?$/s.exec(trimmed);
  if (!funcMatch) return null;

  const funcName = funcMatch[1] ?? '';
  const argsStr = funcMatch[2]; // Will be undefined if no parentheses

  if (argsStr !== undefined || (/^[a-zA-Z_]/.test(funcName) && !JQ_KEYWORDS.has(funcName))) {
    const args = argsStr ? splitTopLevel(argsStr, ';').map((arg) => parse(arg)) : [];
    return {
      type: 'FunctionCall',
      name: funcName,
      args,
    };
  }

  return null;
}
