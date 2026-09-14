/**
 * @fileoverview Parses a jq atom — a path, a variable reference, or a
 * parenthesised group with an optional input-free postfix path.
 */

import { type ASTNode, type ASTVariableNode } from '../types';
import { matchingCloseParen } from './top-level-scan';

/** Signature of the recursive expression parser passed in to avoid a circular import. */
type ParseExpressionFn = (expression: string) => ASTNode;

/**
 * One or more postfix path segments that read nothing from their input's
 * ORIGINAL context: literal fields, literal string keys (kept `]`-free and
 * escape-free because the segment scanner reads a bracket to its first `]`),
 * `$var` indexes, literal numbers, literal ranges, and bare `[]` iteration.
 * A computed index (`[.k]`) is NOT in this set — jq evaluates it against the
 * input of the whole path term, which a pipe rewrite cannot reproduce.
 */
const INPUT_FREE_POSTFIX_PATH =
  /^(?:\.[a-zA-Z_]\w*|\[(?:"[^"\\\]]*"|\$[a-zA-Z_]\w*|-?\d+|-?\d*:-?\d+|-?\d+:-?\d*|)\])+$/;

/**
 * Parses a path, a variable reference or a parenthesised group, or returns null
 * when the text is none of these.
 *
 * @param trimmed - Trimmed expression text with no top-level pipe
 * @param parse - The recursive expression parser, for group contents
 * @returns The atom AST node, or null when the text is not an atom
 */
export function parseAtom(trimmed: string, parse: ParseExpressionFn): ASTNode | null {
  // Path expression
  if (trimmed.startsWith('.')) {
    return {
      type: 'Path',
      value: trimmed,
    };
  }

  // Variable reference, with an optional postfix path — `$a.field`, `$a["key"]`
  // — which composes onto the reference exactly as it would onto `.`
  const varMatch = /^\$([a-zA-Z_]\w*)([.[].*)?$/s.exec(trimmed);
  if (varMatch) {
    const node: ASTVariableNode = { type: 'Variable', name: varMatch[1] ?? '' };
    if (varMatch[2] !== undefined) node.path = varMatch[2];
    return node;
  }

  // Wrapped in parentheses — unwrap and parse
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return parse(trimmed.slice(1, -1));
  }

  // Parenthesised pipeline with a postfix path — `(.a | .b).c`, `(.x)["key"]`.
  // The group's output pipes into the path, which is exactly what the postfix
  // means — PROVIDED the postfix reads nothing from the group's input: a
  // bracket index holding an expression (`(.a)[.b]`) evaluates that expression
  // against the ORIGINAL input, which piping cannot reproduce, so only
  // input-free segments (literal fields, string keys, numbers, ranges, `[]`,
  // `$vars`) take this branch and anything else keeps the honest parse-fail.
  if (trimmed.startsWith('(')) {
    const close = matchingCloseParen(trimmed, 0);
    if (close !== -1 && close < trimmed.length - 1) {
      const postfix = trimmed.substring(close + 1).trim();
      if (INPUT_FREE_POSTFIX_PATH.test(postfix)) {
        return {
          type: 'Pipe',
          left: parse(trimmed.substring(1, close)),
          right: { type: 'Path', value: postfix.startsWith('.') ? postfix : `.${postfix}` },
        };
      }
    }
  }

  return null;
}
