/**
 * @fileoverview Tests for function declaration extractor.
 */

import { describe, it, expect } from 'vitest';
import { extractFunctionDeclarations } from './function-declaration-extractor';

describe('extractFunctionDeclarations', () => {
  it('should extract a single function declaration with params', () => {
    const result = extractFunctionDeclarations('def double(f): f * 2;\n\n. | map(double(.))');
    expect(result.declarations).toHaveLength(1);
    expect(result.declarations[0]!.name).toBe('double');
    expect(result.declarations[0]!.params).toEqual(['f']);
    expect(result.declarations[0]!.body).toBe('f * 2');
    expect(result.mainExpression).toBe('. | map(double(.))');
  });

  it('should extract a parameterless function declaration', () => {
    const result = extractFunctionDeclarations('def id: .;\n\n. | id');
    expect(result.declarations).toHaveLength(1);
    expect(result.declarations[0]!.name).toBe('id');
    expect(result.declarations[0]!.params).toEqual([]);
    expect(result.declarations[0]!.body).toBe('.');
    expect(result.mainExpression).toBe('. | id');
  });

  it('should extract multiple function declarations', () => {
    const result = extractFunctionDeclarations('def a: 1;\n\ndef b(x): x + 1;\n\n.');
    expect(result.declarations).toHaveLength(2);
    expect(result.declarations[0]!.name).toBe('a');
    expect(result.declarations[0]!.params).toEqual([]);
    expect(result.declarations[0]!.body).toBe('1');
    expect(result.declarations[1]!.name).toBe('b');
    expect(result.declarations[1]!.params).toEqual(['x']);
    expect(result.declarations[1]!.body).toBe('x + 1');
    expect(result.mainExpression).toBe('.');
  });

  it('should handle nested parens in body', () => {
    const result = extractFunctionDeclarations('def f(x): (x + 1) * 2;\n\n.');
    expect(result.declarations[0]!.body).toBe('(x + 1) * 2');
  });

  it('should handle nested brackets in body', () => {
    const result = extractFunctionDeclarations('def f: [1, 2, 3];\n\n.');
    expect(result.declarations[0]!.body).toBe('[1, 2, 3]');
  });

  it('should handle nested braces in body', () => {
    const result = extractFunctionDeclarations('def f: {"a": 1};\n\n.');
    expect(result.declarations[0]!.body).toBe('{"a": 1}');
  });

  it('should handle string literals with semicolons in body', () => {
    const result = extractFunctionDeclarations('def f: "hello;world";\n\n.');
    expect(result.declarations[0]!.body).toBe('"hello;world"');
  });

  it('should return no declarations for a plain expression', () => {
    const result = extractFunctionDeclarations('. | keys | sort');
    expect(result.declarations).toHaveLength(0);
    expect(result.mainExpression).toBe('. | keys | sort');
  });

  it('should handle multiple params separated by semicolons', () => {
    const result = extractFunctionDeclarations('def f(a; b; c): a + b + c;\n\n.');
    expect(result.declarations[0]!.params).toEqual(['a', 'b', 'c']);
  });

  it('should default to identity when no main expression remains', () => {
    const result = extractFunctionDeclarations('def f: 1;');
    expect(result.declarations).toHaveLength(1);
    expect(result.mainExpression).toBe('.');
  });

  it('should handle function body with conditionals', () => {
    const result = extractFunctionDeclarations('def f(x): if x > 0 then x else 0 end;\n\n.');
    expect(result.declarations[0]!.body).toBe('if x > 0 then x else 0 end');
  });

  it('should handle function body with function calls containing semicolons', () => {
    const result = extractFunctionDeclarations('def f(x): range(0; x);\n\n.');
    expect(result.declarations[0]!.body).toBe('range(0; x)');
  });
});
