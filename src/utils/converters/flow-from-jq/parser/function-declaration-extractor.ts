/**
 * @fileoverview Extracts function declarations from jq expressions.
 *
 * Handles the `def name(param1; param2): body;` syntax at the top level.
 * Must be called before the main expression parser since `parseJQExpression`
 * does not recognize `def` blocks.
 */

import { commentEnd } from './utils';

export interface FunctionDeclaration {
  name: string;
  params: string[];
  body: string;
}

export interface ExtractionResult {
  declarations: FunctionDeclaration[];
  mainExpression: string;
}

/**
 * Finds the matching `;` that terminates a function body at depth 0.
 * Tracks nesting for `()`, `[]`, `{}`, string literals and `#` comments.
 *
 * @param str - String to scan (starting AFTER the `:`)
 * @returns Index of the closing `;` relative to `str`, or -1 if not found
 */
function findBodyEnd(str: string): number {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
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

    if (char === '#') {
      i = commentEnd(str, i);
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
    } else if (depth === 0 && char === ';') {
      return i;
    }
  }

  return -1;
}

/**
 * Splits the comment lines a string opens with from the rest of it.
 *
 * @param str - String to split
 * @returns The leading comment lines, as written, and the rest of the string
 */
function splitLeadingCommentLines(str: string): { comments: string[]; rest: string } {
  const lines = str.split('\n');
  const comments: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = (lines[index] ?? '').trim();
    if (line !== '') {
      if (!line.startsWith('#')) break;
      comments.push(line);
    }
    index++;
  }

  return { comments, rest: lines.slice(index).join('\n').trim() };
}

/**
 * Extracts top-level function declarations from a jq expression string.
 *
 * Function declarations in jq have the form: `def name(p1; p2): body;`
 * They appear at the top of the expression, before the main flow.
 * Multiple declarations are separated by whitespace.
 *
 * A declaration hangs off the Start node's functions handle, which is no chain,
 * so a comment written above one has no place there: it is moved to the head of
 * the main expression, which is the nearest chain that can hold it.
 *
 * @param expression - The full jq expression string
 * @returns Object with extracted declarations and the remaining main expression
 *
 * @example
 * extractFunctionDeclarations('def double(f): f * 2;\n\n. | map(double(.))')
 * // Returns:
 * // { declarations: [{ name: 'double', params: ['f'], body: 'f * 2' }],
 * //   mainExpression: '. | map(double(.))' }
 */
export function extractFunctionDeclarations(expression: string): ExtractionResult {
  const declarations: FunctionDeclaration[] = [];
  const hoistedComments: string[] = [];
  let remaining = expression.trim();

  for (;;) {
    const { comments, rest } = splitLeadingCommentLines(remaining);
    if (!rest.startsWith('def ')) break;
    hoistedComments.push(...comments);
    remaining = rest;

    // Skip 'def '
    let pos = 4;

    // Read function name (word characters)
    const nameMatch = /^(\w+)/.exec(remaining.substring(pos));
    if (!nameMatch) {
      throw new Error('Invalid function declaration: missing function name');
    }
    const name = nameMatch[1] ?? '';
    pos += name.length;

    // Skip whitespace
    while (pos < remaining.length && /\s/.test(remaining[pos] ?? '')) pos++;

    // Read parameters (if present)
    const params: string[] = [];
    if (remaining[pos] === '(') {
      pos++; // skip '('
      const closeParenIdx = remaining.indexOf(')', pos);
      if (closeParenIdx === -1) {
        throw new Error(`Invalid function declaration: unclosed parentheses in def ${name}`);
      }
      const paramStr = remaining.substring(pos, closeParenIdx).trim();
      if (paramStr.length > 0) {
        params.push(...paramStr.split(';').map((p) => p.trim()));
      }
      pos = closeParenIdx + 1;
    }

    // Skip whitespace
    while (pos < remaining.length && /\s/.test(remaining[pos] ?? '')) pos++;

    // Expect ':'
    if (remaining[pos] !== ':') {
      throw new Error(`Invalid function declaration: expected ':' after parameters in def ${name}`);
    }
    pos++; // skip ':'

    // Find the body end (matching ';' at depth 0)
    const bodyStart = pos;
    const bodyStr = remaining.substring(bodyStart);
    const semiIdx = findBodyEnd(bodyStr);
    if (semiIdx === -1) {
      throw new Error(`Invalid function declaration: missing closing ';' for def ${name}`);
    }

    const body = bodyStr.substring(0, semiIdx).trim();
    declarations.push({ name, params, body });

    // Advance past the ';'
    remaining = remaining.substring(bodyStart + semiIdx + 1).trim();
  }

  const mainLines = [...hoistedComments, remaining].filter((line) => line !== '');

  return {
    declarations,
    mainExpression: mainLines.join('\n') || '.',
  };
}
