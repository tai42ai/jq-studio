/**
 * @fileoverview Extracts function declarations from jq expressions.
 *
 * Handles the `def name(param1; param2): body;` syntax at the top level.
 * Must be called before the main expression parser since `parseJQExpression`
 * does not recognize `def` blocks.
 */

import { scanTopLevel } from '../../jq-lex';

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
  for (const { char, index, depth } of scanTopLevel(str)) {
    if (depth === 0 && char === ';') return index;
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
 * Reads one `def name(p1; p2): body;` declaration from the head of `source`.
 *
 * @param source - Text beginning with `def `
 * @returns The declaration and the trimmed text that follows its closing `;`
 * @throws {Error} If the declaration syntax is invalid
 */
function parseOneDeclaration(source: string): {
  declaration: FunctionDeclaration;
  rest: string;
} {
  // Skip 'def '
  let pos = 4;

  // Read function name (word characters)
  const nameMatch = /^(\w+)/.exec(source.substring(pos));
  if (!nameMatch) {
    throw new Error('Invalid function declaration: missing function name');
  }
  const name = nameMatch[1] ?? '';
  pos += name.length;

  // Skip whitespace
  while (pos < source.length && /\s/.test(source[pos] ?? '')) pos++;

  // Read parameters (if present)
  const params: string[] = [];
  if (source[pos] === '(') {
    pos++; // skip '('
    const closeParenIdx = source.indexOf(')', pos);
    if (closeParenIdx === -1) {
      throw new Error(`Invalid function declaration: unclosed parentheses in def ${name}`);
    }
    const paramStr = source.substring(pos, closeParenIdx).trim();
    if (paramStr.length > 0) {
      params.push(...paramStr.split(';').map((p) => p.trim()));
    }
    pos = closeParenIdx + 1;
  }

  // Skip whitespace
  while (pos < source.length && /\s/.test(source[pos] ?? '')) pos++;

  // Expect ':'
  if (source[pos] !== ':') {
    throw new Error(`Invalid function declaration: expected ':' after parameters in def ${name}`);
  }
  pos++; // skip ':'

  // Find the body end (matching ';' at depth 0)
  const bodyStart = pos;
  const bodyStr = source.substring(bodyStart);
  const semiIdx = findBodyEnd(bodyStr);
  if (semiIdx === -1) {
    throw new Error(`Invalid function declaration: missing closing ';' for def ${name}`);
  }

  const body = bodyStr.substring(0, semiIdx).trim();

  return {
    declaration: { name, params, body },
    rest: source.substring(bodyStart + semiIdx + 1).trim(),
  };
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

    const { declaration, rest: afterDeclaration } = parseOneDeclaration(rest);
    declarations.push(declaration);
    remaining = afterDeclaration;
  }

  const mainLines = [...hoistedComments, remaining].filter((line) => line !== '');

  return {
    declarations,
    mainExpression: mainLines.join('\n') || '.',
  };
}
