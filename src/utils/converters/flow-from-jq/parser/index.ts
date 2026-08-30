/**
 * @fileoverview Main jq expression parser.
 *
 * Production-ready parser with comprehensive support for jq syntax.
 */

import { type ASTNode } from '../types';
import { MAX_EXPRESSION_LENGTH } from '../constants';
import { findTopLevelOperator, splitTopLevel, unescapeString } from './utils';
import { splitChainComments } from './comment-extractor';
import { tryParseOperator } from './operator-parser';
import { parseConditional } from './conditional-parser';
import { parseTryCatch } from './trycatch-parser';
import { parseArray, parseObject } from './array-object-parser';

/**
 * Production-ready jq expression parser with comprehensive support.
 *
 * Supports:
 * - All literals: strings, numbers, booleans, null, arrays, objects
 * - Path expressions: .field, .field.nested, .[index], .[start:end]
 * - Pipe operator: expr | expr
 * - Variable assignment: expr as $var
 * - Variable references: $var
 * - Function calls: functionName(arg1; arg2; ...)
 * - Operators: +, -, *, /, %, ==, !=, <, <=, >, >=, and, or, not, //, ?
 * - Conditionals: if cond then value elif cond then value else value end
 * - Array construction: [elem1, elem2, ...]
 * - Object construction: {key1: value1, key2: value2, ...}
 *
 * A `#` comment is a stage of the pipe chain it is written in: the parser reads
 * one into a Comment node of that chain, in the place it holds there, so a
 * comment inside a branch, an argument or an item stays inside it.
 *
 * @param expression - The jq expression to parse
 * @returns AST representation of the expression
 * @throws {Error} If expression is too long or malformed
 *
 * @example
 * parseJQExpression('. | map(.x)'); // Returns AST for pipe operation
 */
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

export function parseJQExpression(expression: string): ASTNode {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(
      `Expression exceeds maximum length of ${String(MAX_EXPRESSION_LENGTH)} characters`,
    );
  }

  return foldChain(parseChainItems(expression));
}

/**
 * Folds a chain's stages into right-nested `Pipe` nodes.
 *
 * The converter reads a `Pipe` as "connect the left node to the entry of the
 * right side", so a chain nests to the right — a left-nested `Pipe` would wire
 * the chain's entry to its own successor and skip the stages between.
 *
 * @param items - The chain's stages, in order, at least one
 */
function foldChain(items: ASTNode[]): ASTNode {
  return items.reduceRight((right, left) => ({ type: 'Pipe', left, right }));
}

/**
 * Parses one expression into the ordered stages of the pipe chain it forms.
 *
 * Splitting on the top-level `|` gives the chain's segments; each segment's own
 * leading and trailing comments are stages of this chain, and the expression
 * text between them is one more. A comment inside that text annotates a chain a
 * nested construct builds, so it travels on in the text to the parser that
 * slices the construct apart.
 *
 * @param expression - The expression to read as a chain
 * @returns The chain's stages, at least one
 * @throws {Error} If the expression holds neither an expression nor a comment
 */
function parseChainItems(expression: string): ASTNode[] {
  const trimmed = expression.trim();

  // Check for pipe operator (lowest precedence) - avoid pipes inside parentheses/brackets
  const pipeIndex = findTopLevelOperator(trimmed, '|');
  if (pipeIndex !== -1) {
    return [
      ...parseChainItems(trimmed.substring(0, pipeIndex)),
      ...parseChainItems(trimmed.substring(pipeIndex + 1)),
    ];
  }

  const { leading, core, trailing } = splitChainComments(trimmed);

  const items: ASTNode[] = [];
  if (leading !== null) items.push({ type: 'Comment', text: leading });
  if (core !== '') items.push(parseTerm(core));
  if (trailing !== null) items.push({ type: 'Comment', text: trailing });

  if (items.length === 0) {
    throw new Error('JQ expression cannot be empty');
  }
  return items;
}

/**
 * Parses one chain stage's expression text — everything but the pipe chain,
 * which {@link parseChainItems} has already split.
 *
 * @param expression - Expression text with no top-level pipe and no comment of its own
 * @returns AST representation of the expression
 * @throws {Error} If the expression is malformed
 */
function parseTerm(expression: string): ASTNode {
  const trimmed = expression.trim();

  if (trimmed === '.') {
    return { type: 'Identity', value: '.' };
  }

  // Check for variable assignment (as $var)
  const asMatch = /^(.+?)\s+as\s+\$(\w+)$/.exec(trimmed);
  if (asMatch) {
    return {
      type: 'Assignment',
      value: parseJQExpression(asMatch[1] ?? ''),
      variable: asMatch[2] ?? '',
    };
  }

  // Check for conditional (if/elif/else/end)
  if (trimmed.startsWith('if ')) {
    return parseConditional(trimmed, parseJQExpression);
  }

  // Check for try-catch (try EXPR [catch EXPR])
  if (trimmed.startsWith('try ')) {
    return parseTryCatch(trimmed, parseJQExpression);
  }

  // Check for operators (binary and unary operators)
  const operatorNode = tryParseOperator(trimmed, parseJQExpression);
  if (operatorNode) {
    return operatorNode;
  }

  // Check for array literal [...]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return parseArray(trimmed, parseJQExpression);
  }

  // Check for object literal {...}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parseObject(trimmed, parseJQExpression);
  }

  // Check for function call (with or without parentheses)
  // In jq, any bare identifier is a valid filter invocation — including function
  // parameters (e.g., `f` in `def double(f): f * 2;`).
  const funcMatch = /^(\w+)(?:\((.*)\))?$/s.exec(trimmed);
  if (funcMatch) {
    const funcName = funcMatch[1] ?? '';
    const argsStr = funcMatch[2]; // Will be undefined if no parentheses

    // Treat as function call if:
    // - Has parentheses (explicit function call), OR
    // - Is a bare identifier starting with a letter/underscore (valid jq name)
    //   that is NOT a keyword (true/false/null are handled below)
    const JQ_KEYWORDS = new Set(['true', 'false', 'null']);
    if (argsStr !== undefined || (/^[a-zA-Z_]/.test(funcName) && !JQ_KEYWORDS.has(funcName))) {
      const args = argsStr ? splitTopLevel(argsStr, ';').map((arg) => parseJQExpression(arg)) : [];

      return {
        type: 'FunctionCall',
        name: funcName,
        args,
      };
    }
  }

  // Check for string literal
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
      value: unescapeString(raw),
    };
  }

  // Check for number literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return {
      type: 'Number',
      value: parseFloat(trimmed),
    };
  }

  // Check for boolean literal
  if (trimmed === 'true' || trimmed === 'false') {
    return {
      type: 'Boolean',
      value: trimmed === 'true',
    };
  }

  // Check for null literal
  if (trimmed === 'null') {
    return {
      type: 'Null',
      value: null,
    };
  }

  // Check for path expression
  if (trimmed.startsWith('.')) {
    return {
      type: 'Path',
      value: trimmed,
    };
  }

  // Check for variable reference
  if (trimmed.startsWith('$')) {
    return {
      type: 'Variable',
      name: trimmed.substring(1),
    };
  }

  // If wrapped in parentheses, unwrap and parse
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return parseJQExpression(trimmed.slice(1, -1));
  }

  throw new Error(`Unable to parse jq expression: ${trimmed}`);
}
