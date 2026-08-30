/**
 * @fileoverview Conditional expression parser (if/elif/else/end).
 *
 * Uses tokenization so keywords inside string literals are not matched.
 */

import { type ASTConditionalNode, type ASTNode } from '../types';
import { commentEnd, controlKeywordAt } from './utils';

/** Signature of the recursive expression parser passed in to avoid a circular import. */
type ParseExpressionFn = (expression: string) => ASTNode;

/**
 * Finds the position of a keyword at top level (not inside strings, comments or
 * nested structures).
 *
 * Handles string literals and `#` comments to avoid false keyword matches.
 *
 * @param str - String to search
 * @param keyword - Keyword to find
 * @param startIndex - Index to start searching from
 * @returns Index of keyword, or -1 if not found
 */
export function findTopLevelKeyword(str: string, keyword: string, startIndex = 0): number {
  let inString = false;
  let escapeNext = false;
  let depth = 0;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    // A keyword written inside a comment is text, not a branch boundary
    if (char === '#') {
      i = commentEnd(str, i);
      continue;
    }

    // A nested `if … end` carries its own then/elif/else — they bound its
    // branches, not the branches of the conditional being read here
    if (controlKeywordAt(str, i, 'if')) {
      depth++;
      i += 1;
      continue;
    }
    if (controlKeywordAt(str, i, 'end')) {
      depth--;
      i += 2;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
    } else if (depth === 0) {
      // Check if keyword matches at this position
      const remaining = str.substring(i);
      if (remaining.startsWith(keyword)) {
        // Ensure it's a complete word (not part of a longer identifier)
        const before = i === 0 || /\s/.test(str[i - 1] ?? '');
        const after = i + keyword.length >= str.length || /\s/.test(str[i + keyword.length] ?? '');
        if (before && after) {
          return i;
        }
      }
    }
  }

  return -1;
}

/**
 * Parses a conditional expression (if/elif/else/end).
 *
 * Uses tokenization so keywords inside strings are not matched.
 *
 * @param str - Conditional expression string
 * @param parseFn - Function to parse child expressions
 * @returns Conditional AST node
 * @throws {Error} If conditional syntax is invalid
 *
 * @example
 * parseConditional('if .x == "string with elif" then .y else .z end');
 * // Correctly parses without matching 'elif' inside the string
 */
export function parseConditional(str: string, parseFn: ParseExpressionFn): ASTConditionalNode {
  // Remove the 'if ' prefix and the closing 'end' keyword, whatever whitespace
  // separates it from the branch before it — a space or a line break
  if (!/\send$/.test(str)) {
    throw new Error('Conditional expression must end with "end"');
  }

  const content = str.substring(3, str.length - 3).trim();
  const branches: { condition: ASTNode; then: ASTNode }[] = [];
  let elseBranch: ASTNode | undefined;

  let currentPos = 0;

  while (currentPos < content.length) {
    // Find 'then' keyword
    const thenPos = findTopLevelKeyword(content, 'then', currentPos);
    if (thenPos === -1) {
      throw new Error('Invalid conditional syntax: missing "then"');
    }

    // Extract condition (everything before 'then')
    const conditionStr = content.substring(currentPos, thenPos).trim();
    const condition = parseFn(conditionStr);

    // Find next keyword after 'then' (either 'elif', 'else', or end of string)
    const thenStart = thenPos + 4; // Skip 'then'
    const elifPos = findTopLevelKeyword(content, 'elif', thenStart);
    const elsePos = findTopLevelKeyword(content, 'else', thenStart);

    let resultStr: string;
    let nextPos: number;

    if (elifPos !== -1 && (elsePos === -1 || elifPos < elsePos)) {
      // Next is 'elif'
      resultStr = content.substring(thenStart, elifPos).trim();
      nextPos = elifPos + 4; // Skip 'elif'
    } else if (elsePos !== -1) {
      // Next is 'else'
      resultStr = content.substring(thenStart, elsePos).trim();
      // Parse else branch and finish
      const elseStart = elsePos + 4; // Skip 'else'
      const elseBranchStr = content.substring(elseStart).trim();
      branches.push({ condition, then: parseFn(resultStr) });
      elseBranch = parseFn(elseBranchStr);
      break;
    } else {
      // No more branches
      resultStr = content.substring(thenStart).trim();
      branches.push({ condition, then: parseFn(resultStr) });
      break;
    }

    branches.push({ condition, then: parseFn(resultStr) });
    currentPos = nextPos;
  }

  return {
    type: 'Conditional',
    branches,
    elseBranch,
  };
}
