/**
 * @fileoverview Main jq expression parser.
 *
 * Production-ready parser with comprehensive support for jq syntax.
 */

import { MAX_EXPRESSION_LENGTH } from '../constants';
import { type ASTNode } from '../types';
import { parseArray, parseObject } from './array-object-parser';
import { parseAssignment } from './assignment-parser';
import { parseAtom } from './atom-parser';
import { splitChainComments } from './comment-extractor';
import { parseConditional } from './conditional-parser';
import { parseFunctionCall } from './function-call-parser';
import { parseLiteral } from './literal-parser';
import { tryParseOperator } from './operator-parser';
import { findTopLevelOperator } from './top-level-scan';
import { parseTryCatch } from './trycatch-parser';

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

  const assignment = parseAssignment(trimmed, parseJQExpression);
  if (assignment) return assignment;

  // Conditional (if/elif/else/end)
  if (trimmed.startsWith('if ')) {
    return parseConditional(trimmed, parseJQExpression);
  }

  // Try-catch (try EXPR [catch EXPR])
  if (trimmed.startsWith('try ')) {
    return parseTryCatch(trimmed, parseJQExpression);
  }

  // Binary and unary operators
  const operatorNode = tryParseOperator(trimmed, parseJQExpression);
  if (operatorNode) return operatorNode;

  // Array literal [...]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return parseArray(trimmed, parseJQExpression);
  }

  // Object literal {...}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parseObject(trimmed, parseJQExpression);
  }

  const call = parseFunctionCall(trimmed, parseJQExpression);
  if (call) return call;

  const literal = parseLiteral(trimmed);
  if (literal) return literal;

  const atom = parseAtom(trimmed, parseJQExpression);
  if (atom) return atom;

  throw new Error(`Unable to parse jq expression: ${trimmed}`);
}
