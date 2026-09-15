/**
 * @fileoverview Tests for the shared jq lexical walk.
 */

import { describe, expect, it } from 'vitest';

import { type JqLexeme, lexJq, type ScanChar, scanTopLevel } from './jq-lex';

const lex = (str: string, start?: number): JqLexeme[] => [...lexJq(str, start)];
const scan = (str: string, options?: { countKeywords?: boolean; start?: number }): ScanChar[] => [
  ...scanTopLevel(str, options),
];

/** The depth for a given source index, or undefined when that index is skipped. */
const depthAt = (chars: ScanChar[], index: number): number | undefined =>
  chars.find((c) => c.index === index)?.depth;

describe('lexJq', () => {
  it('classifies plain code one character at a time', () => {
    expect(lex('.a')).toEqual([
      { kind: 'code', char: '.', index: 0 },
      { kind: 'code', char: 'a', index: 1 },
    ]);
  });

  it('yields a string literal as one unit spanning past its close quote', () => {
    expect(lex('"ab"')).toEqual([{ kind: 'string', index: 0, end: 4 }]);
  });

  it('keeps a string open across an escaped quote', () => {
    // "a\"b" — the \" does not close the literal
    expect(lex('"a\\"b"')).toEqual([{ kind: 'string', index: 0, end: 6 }]);
  });

  it('treats an unterminated string as running to the end', () => {
    expect(lex('"abc')).toEqual([{ kind: 'string', index: 0, end: 4 }]);
  });

  it('yields a comment as one unit ending at the newline', () => {
    expect(lex('.#c\n.b')).toEqual([
      { kind: 'code', char: '.', index: 0 },
      { kind: 'comment', index: 1, end: 3 },
      { kind: 'code', char: '\n', index: 3 },
      { kind: 'code', char: '.', index: 4 },
      { kind: 'code', char: 'b', index: 5 },
    ]);
  });

  it('runs a comment with no newline to the end of the string', () => {
    expect(lex('. # hi')).toEqual([
      { kind: 'code', char: '.', index: 0 },
      { kind: 'code', char: ' ', index: 1 },
      { kind: 'comment', index: 2, end: 6 },
    ]);
  });

  it('does not start a comment inside a string', () => {
    expect(lex('"# not a comment"')).toEqual([{ kind: 'string', index: 0, end: 17 }]);
  });

  it('begins at the requested start index', () => {
    expect(lex('abc', 1)).toEqual([
      { kind: 'code', char: 'b', index: 1 },
      { kind: 'code', char: 'c', index: 2 },
    ]);
  });
});

describe('scanTopLevel', () => {
  it('keeps depth 0 across a flat expression', () => {
    expect(scan('a|b').every((c) => c.depth === 0)).toBe(true);
  });

  it('raises depth inside brackets — opener before, closer after', () => {
    // (a|b): '(' reports 0 then depth rises; ')' drops then reports 0
    const chars = scan('(a|b)');
    expect(depthAt(chars, 0)).toBe(0); // (
    expect(depthAt(chars, 1)).toBe(1); // a
    expect(depthAt(chars, 2)).toBe(1); // |
    expect(depthAt(chars, 3)).toBe(1); // b
    expect(depthAt(chars, 4)).toBe(0); // )
  });

  it('reports a negative depth for a closer with no opener', () => {
    expect(depthAt(scan(')'), 0)).toBe(-1);
  });

  it('skips string and comment content', () => {
    // Only the two dots are code; the string and comment are skipped
    expect(scan('."x".#c').map((c) => c.char)).toEqual(['.', '.']);
  });

  it('counts if…end as a nesting level only when asked', () => {
    const expr = 'if .a then .b end';
    // '.b' sits at index 11
    expect(depthAt(scan(expr, { countKeywords: true }), 11)).toBe(1);
    expect(depthAt(scan(expr, { countKeywords: false }), 11)).toBe(0);
  });

  it('steps over the if/end keyword characters when counting them', () => {
    // 'i' and 'f' (indices 0,1) are consumed by the keyword, not yielded
    const chars = scan('if .a then .b end', { countKeywords: true });
    expect(chars.some((c) => c.index === 0 || c.index === 1)).toBe(false);
  });

  it('begins at the requested start index', () => {
    // From the opening paren, its matching close returns to depth 0
    const chars = scan('a(b)', { start: 1 });
    expect(depthAt(chars, 1)).toBe(0); // (
    expect(depthAt(chars, 3)).toBe(0); // )
  });
});
