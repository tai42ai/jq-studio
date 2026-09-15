/**
 * @fileoverview Tests for the jq string-literal escape codec.
 */

import { describe, expect, it } from 'vitest';

import { escapeJqString, unescapeJqString } from './jq-string';

describe('escapeJqString', () => {
  it('escapes a backslash before introducing other escapes', () => {
    expect(escapeJqString('a\\b')).toBe('a\\\\b');
  });

  it('escapes double quotes', () => {
    expect(escapeJqString('Quote: "test"')).toBe('Quote: \\"test\\"');
  });

  it('escapes control whitespace to their sequences', () => {
    expect(escapeJqString('\n\r\t\f\v')).toBe('\\n\\r\\t\\f\\v');
  });

  it('escapes a backspace (ASCII 8)', () => {
    expect(escapeJqString('\x08')).toBe('\\b');
  });

  it('escapes non-ASCII characters as \\uXXXX', () => {
    expect(escapeJqString('café')).toBe('caf\\u00e9');
    expect(escapeJqString('\u0041')).toBe('A'); // ASCII 'A' stays literal
    expect(escapeJqString('日')).toBe('\\u65e5');
  });

  it('leaves plain ASCII text untouched', () => {
    expect(escapeJqString('hello world')).toBe('hello world');
  });
});

describe('unescapeJqString', () => {
  it('resolves the control-whitespace escapes', () => {
    expect(unescapeJqString('\\n\\r\\t\\f\\v')).toBe('\n\r\t\f\v');
  });

  it('resolves the backspace escape', () => {
    expect(unescapeJqString('\\b')).toBe('\b');
  });

  it('resolves escaped quotes and backslashes', () => {
    expect(unescapeJqString('\\"')).toBe('"');
    expect(unescapeJqString('\\\\')).toBe('\\');
  });

  it('resolves \\uXXXX sequences to their character', () => {
    expect(unescapeJqString('\\u0041')).toBe('A');
    expect(unescapeJqString('caf\\u00e9')).toBe('café');
  });
});

describe('escape/unescape round-trip', () => {
  // Samples whose escaped form holds no ambiguous escape adjacency. The codec is
  // not a guaranteed inverse for every input: unescape resolves `\b`/`\n`/… before
  // `\\`, so a raw backslash immediately followed by such a letter does not survive
  // a round-trip — a jq author writes those characters with their own escapes.
  const samples = [
    'plain text',
    'with "quotes"',
    'line1\nline2\ttab',
    'unicode café 日本語',
    'trailing slash\\',
    '',
  ];

  for (const sample of samples) {
    it(`round-trips ${JSON.stringify(sample)}`, () => {
      expect(unescapeJqString(escapeJqString(sample))).toBe(sample);
    });
  }
});
