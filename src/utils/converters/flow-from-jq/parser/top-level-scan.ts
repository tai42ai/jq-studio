/**
 * @fileoverview Top-level structural scans over a jq expression — the operator,
 * paren and delimiter finders the parser splits an expression on.
 *
 * Each reads the shared {@link scanTopLevel} walk, so a bracket, operator or
 * delimiter written inside a string literal or a `#` comment is never counted.
 */

import { scanTopLevel } from '../../jq-lex';

/**
 * Finds the index of a top-level operator (not inside brackets, `if…end`,
 * strings or comments).
 *
 * A word operator (`and`, `or`, `not`) matches only when it stands as a whole
 * word; any other operator matches on its literal text.
 *
 * @param str - String to search
 * @param operator - Operator to find
 * @returns Index of operator, or -1 if not found
 *
 * @example
 * findTopLevelOperator("a | (b | c)", "|"); // Returns: 2 (first pipe, not the one in parentheses)
 */
export function findTopLevelOperator(str: string, operator: string): number {
  const isWordOperator = /^\w+$/.test(operator);

  for (const { index, depth } of scanTopLevel(str, { countKeywords: true })) {
    if (depth !== 0 || !str.startsWith(operator, index)) continue;
    if (!isWordOperator) return index;

    const before = index === 0 || /\s/.test(str[index - 1] ?? '');
    const after =
      index + operator.length >= str.length || /\s/.test(str[index + operator.length] ?? '');
    if (before && after) return index;
  }

  return -1;
}

/**
 * Finds the index of the `)` that closes the `(` at `openIndex`, stepping over
 * strings, comments and nested brackets.
 *
 * @param str - String to scan
 * @param openIndex - Index of the opening parenthesis
 * @returns Index of the matching close paren, or -1 when it never closes
 */
export function matchingCloseParen(str: string, openIndex: number): number {
  for (const { char, index, depth } of scanTopLevel(str, { start: openIndex })) {
    if (depth === 0 && (char === ')' || char === ']' || char === '}')) return index;
  }
  return -1;
}

/**
 * Splits a string by delimiter at top level (not inside brackets, strings or
 * comments).
 *
 * Comment and string text is kept in the part it was written in — the parser
 * that reads the part decides which chain a comment annotates. A trailing empty
 * part is dropped; an empty part between two delimiters is kept.
 *
 * @param str - String to split
 * @param delimiter - Single-character delimiter
 * @returns Array of split parts
 *
 * @example
 * splitTopLevel("[1, [2, 3]], 4", ","); // Returns: ["[1, [2, 3]]", " 4"]
 */
export function splitTopLevel(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let partStart = 0;

  for (const { char, index, depth } of scanTopLevel(str)) {
    if (depth === 0 && char === delimiter) {
      parts.push(str.substring(partStart, index));
      partStart = index + 1;
    }
  }

  const tail = str.substring(partStart);
  if (tail.length > 0) parts.push(tail);

  return parts;
}
