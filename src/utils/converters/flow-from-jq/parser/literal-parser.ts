/**
 * @fileoverview Parses a jq scalar literal — string, number, boolean or null.
 */

import { type ASTNode } from '../types';
import { unescapeJqString } from '../../jq-string';

/**
 * Reports whether a string literal's raw content holds a jq interpolation `\(…)`.
 *
 * A backslash escapes the character after it, so an escaped backslash `\\`
 * followed by `(` is a literal paren, not an interpolation — the scan steps over
 * each escaped character so only a real `\(` counts.
 *
 * @param content - The string literal's content, without the surrounding quotes
 * @returns True when an unescaped `\(` interpolation opener is present
 */
function hasStringInterpolation(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\\') {
      if (content[i + 1] === '(') return true;
      i++; // skip the escaped character
    }
  }
  return false;
}

/**
 * Parses a scalar literal, or returns null when the text is not one.
 *
 * @param trimmed - Trimmed expression text with no top-level pipe
 * @returns The literal AST node, or null when the text is not a scalar literal
 * @throws {Error} If a string literal holds a `\(…)` interpolation, which has no
 *   Value-node form and would corrupt the round-trip
 */
export function parseLiteral(trimmed: string): ASTNode | null {
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const raw = trimmed.slice(1, -1);
    // String interpolation `\(expr)` has no Value-node form: the graph would keep
    // the `\(` as literal text, so the round-trip would rewrite the string. Refuse
    // it here (honest PARSE-FAIL) rather than draw a wrong, corrupting graph.
    if (hasStringInterpolation(raw)) {
      throw new Error(`Unable to parse jq expression: ${trimmed}`);
    }
    return {
      type: 'String',
      value: unescapeJqString(raw),
    };
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return {
      type: 'Number',
      value: parseFloat(trimmed),
    };
  }

  if (trimmed === 'true' || trimmed === 'false') {
    return {
      type: 'Boolean',
      value: trimmed === 'true',
    };
  }

  if (trimmed === 'null') {
    return {
      type: 'Null',
      value: null,
    };
  }

  return null;
}
