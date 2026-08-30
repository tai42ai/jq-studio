/**
 * @fileoverview Array and object literal parsers.
 */

import { type ASTArrayNode, type ASTObjectNode, type ASTNode } from '../types';
import { findTopLevelOperator, splitTopLevel } from './utils';
import { splitChainComments } from './comment-extractor';

/** Signature of the recursive expression parser passed in to avoid a circular import. */
type ParseExpressionFn = (expression: string) => ASTNode;

/**
 * Parses an array literal.
 *
 * @param str - Array literal string including brackets
 * @param parseFn - Function to parse child expressions
 * @returns Array AST node
 *
 * @example
 * parseArray('[1, 2, 3]'); // Returns: { type: 'Array', elements: [...] }
 */
export function parseArray(str: string, parseFn: ParseExpressionFn): ASTArrayNode {
  const content = str.slice(1, -1).trim();
  if (content.length === 0) {
    return { type: 'Array', elements: [] };
  }

  const elements = splitTopLevel(content, ',').map((elem) => parseFn(elem.trim()));
  return { type: 'Array', elements };
}

/**
 * Parses an object literal.
 *
 * A comment written on a field's key side annotates the chain the field's value
 * builds — the field itself is a key and a value, with no place of its own for
 * one — so it is read as a stage of that chain, ahead of the value.
 *
 * @param str - Object literal string including braces
 * @param parseFn - Function to parse child expressions
 * @returns Object AST node
 * @throws {Error} If object syntax is invalid
 *
 * @example
 * parseObject('{a: 1, b: 2}'); // Returns: { type: 'Object', fields: [...] }
 */
export function parseObject(str: string, parseFn: ParseExpressionFn): ASTObjectNode {
  const content = str.slice(1, -1).trim();
  if (content.length === 0) {
    return { type: 'Object', fields: [] };
  }

  const fieldStrs = splitTopLevel(content, ',');
  const fields = fieldStrs.map((fieldStr) => {
    const colonIndex = findTopLevelOperator(fieldStr, ':');
    if (colonIndex === -1) {
      throw new Error(`Invalid object field: ${fieldStr}`);
    }

    const {
      leading,
      core: keyPart,
      trailing,
    } = splitChainComments(fieldStr.substring(0, colonIndex));
    const valuePart = fieldStr.substring(colonIndex + 1);

    // A computed/dynamic key `{(expr): v}` has no Value-node form: the graph would
    // keep `(expr)` as a literal key string, so the round-trip would rewrite the
    // object. Refuse it here (honest PARSE-FAIL) rather than draw a corrupting graph.
    if (keyPart.startsWith('(')) {
      throw new Error(`Unable to parse jq expression: {${fieldStr.trim()}}`);
    }

    // Remove quotes from key if present
    const key = keyPart.startsWith('"') && keyPart.endsWith('"') ? keyPart.slice(1, -1) : keyPart;

    const keyComments = [leading, trailing].filter((text): text is string => text !== null);
    const value = keyComments.reduceRight<ASTNode>(
      (right, text) => ({ type: 'Pipe', left: { type: 'Comment', text }, right }),
      parseFn(valuePart),
    );

    return { key, value };
  });

  return { type: 'Object', fields };
}
