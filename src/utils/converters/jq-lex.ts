/**
 * @fileoverview One escape-aware lexical walk over a jq expression, shared by
 * every top-level scanner.
 *
 * {@link lexJq} classifies the source into code characters, string literals and
 * `#` comments so a delimiter, operator or keyword written inside a string or a
 * comment is never mistaken for structure. {@link scanTopLevel} layers bracket
 * and `if…end` nesting depth on top, yielding each code character with the depth
 * it sits at — openers report their depth before it rises, closers after it drops.
 */

/** A run of source the walk classifies as one unit. */
export type JqLexeme =
  | { readonly kind: 'code'; readonly char: string; readonly index: number }
  | { readonly kind: 'string'; readonly index: number; readonly end: number }
  | { readonly kind: 'comment'; readonly index: number; readonly end: number };

/** A code character and the bracket/`if…end` nesting depth it sits at. */
export interface ScanChar {
  readonly char: string;
  readonly index: number;
  readonly depth: number;
}

/**
 * Index one past the `#` comment starting at `hashIndex` — the newline that ends
 * its line, or `str.length` when the comment runs to the end of the string.
 */
function commentEnd(str: string, hashIndex: number): number {
  const lineEnd = str.indexOf('\n', hashIndex);
  return lineEnd === -1 ? str.length : lineEnd;
}

/**
 * Index one past the string literal opening at `openIndex`. A `\` escapes the
 * character after it, so `\"` does not close the literal; an unterminated literal
 * runs to the end of the string.
 */
function stringEnd(str: string, openIndex: number): number {
  for (let i = openIndex + 1; i < str.length; i++) {
    const char = str[i];
    if (char === '\\') {
      i++;
      continue;
    }
    if (char === '"') return i + 1;
  }
  return str.length;
}

/**
 * Reports whether `keyword` stands as a whole word at `index`.
 *
 * The character before must not extend it into an identifier, a field (`.end`)
 * or a variable (`$end`), and the character after must not extend it either —
 * `endswith` opens with `end` and is a function, not the closer of an `if`.
 */
function keywordAt(str: string, index: number, keyword: string): boolean {
  if (!str.startsWith(keyword, index)) return false;
  const before = index === 0 ? '' : (str[index - 1] ?? '');
  const after = str[index + keyword.length] ?? '';
  return !/[\w.$]/.test(before) && !/\w/.test(after);
}

/**
 * Index of the first character at or after `index` that is neither whitespace
 * nor comment text, or `str.length` when none remains.
 */
function nextSignificantIndex(str: string, index: number): number {
  let i = index;
  while (i < str.length) {
    const char = str[i] ?? '';
    if (char === '#') {
      i = commentEnd(str, i);
      continue;
    }
    if (!/\s/.test(char)) return i;
    i++;
  }
  return str.length;
}

/**
 * Reports whether the whole word `keyword` at `index` is jq's control keyword
 * rather than the key of an object field.
 *
 * jq accepts a keyword as an unquoted key (`{end: .e}`, `{if: 1}`), where the
 * pair's `:` always follows it; a control keyword is never followed by one, so
 * a scanner counting `if … end` as a nesting level must skip the key.
 */
function controlKeywordAt(str: string, index: number, keyword: string): boolean {
  if (!keywordAt(str, index, keyword)) return false;
  return str[nextSignificantIndex(str, index + keyword.length)] !== ':';
}

/**
 * Walks a jq expression, classifying it into code characters, string literals
 * and `#` comments.
 *
 * A string literal is yielded as one unit spanning `[index, end)`; a comment as
 * one unit spanning from its `#` to the newline that ends its line. Everything
 * else is a code character, yielded one at a time.
 *
 * @param str - The expression to walk
 * @param start - Index to begin at (default 0)
 */
export function* lexJq(str: string, start = 0): Generator<JqLexeme> {
  let i = start;
  while (i < str.length) {
    const char = str[i] ?? '';
    if (char === '"') {
      const end = stringEnd(str, i);
      yield { kind: 'string', index: i, end };
      i = end;
      continue;
    }
    if (char === '#') {
      const end = commentEnd(str, i);
      yield { kind: 'comment', index: i, end };
      i = end;
      continue;
    }
    yield { kind: 'code', char, index: i };
    i++;
  }
}

const OPEN_BRACKETS = new Set(['(', '[', '{']);
const CLOSE_BRACKETS = new Set([')', ']', '}']);

/**
 * The nesting-depth change a top-level `if`/`end` keyword makes at `index`, and
 * the index its characters run to, or null when the position is not one.
 */
function keywordDepthChange(
  str: string,
  index: number,
  countKeywords: boolean,
): { delta: number; skipTo: number } | null {
  if (!countKeywords) return null;
  if (controlKeywordAt(str, index, 'if')) return { delta: 1, skipTo: index + 'if'.length };
  if (controlKeywordAt(str, index, 'end')) return { delta: -1, skipTo: index + 'end'.length };
  return null;
}

/**
 * Walks the code characters of a jq expression, tagging each with its bracket
 * (and optionally `if…end`) nesting depth.
 *
 * An opening bracket reports the depth it sits at and raises the depth for what
 * follows; a closing bracket lowers the depth first and reports the level it
 * closes into — so the closer that returns to depth 0 reports depth 0, and a
 * closer with no opener reports a negative depth. String and comment text is
 * skipped. With `countKeywords`, a top-level `if` opens a level and `end` closes
 * one, the way brackets do, and the keyword's own characters are stepped over.
 *
 * @param str - The expression to walk
 * @param options.countKeywords - Count `if … end` as a nesting level (default false)
 * @param options.start - Index to begin at (default 0)
 */
export function* scanTopLevel(
  str: string,
  options: { countKeywords?: boolean; start?: number } = {},
): Generator<ScanChar> {
  const countKeywords = options.countKeywords ?? false;
  const start = options.start ?? 0;
  let depth = 0;
  let skipUntil = start;

  for (const lexeme of lexJq(str, start)) {
    if (lexeme.kind !== 'code') continue;
    const { char, index } = lexeme;
    if (index < skipUntil) continue;

    const keyword = keywordDepthChange(str, index, countKeywords);
    if (keyword) {
      depth += keyword.delta;
      skipUntil = keyword.skipTo;
      continue;
    }

    if (OPEN_BRACKETS.has(char)) {
      yield { char, index, depth };
      depth++;
    } else if (CLOSE_BRACKETS.has(char)) {
      depth--;
      yield { char, index, depth };
    } else {
      yield { char, index, depth };
    }
  }
}
