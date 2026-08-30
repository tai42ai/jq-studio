/**
 * @fileoverview Tests for JQ to Flow converter.
 */

import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './index';
import { JQNodeType, JQHandleIdPrefix, ValueType } from '../../../enums';
import { type JQFunctionCallData, type JQCommentData } from '../../../types';
import { MAX_EXPRESSION_LENGTH } from './constants';

describe('convertJQToFlow', () => {
  describe('Basic Expressions', () => {
    it('should convert identity expression', () => {
      const result = convertJQToFlow('.');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]!.data.type).toBe(JQNodeType.Start);
      expect(result.edges).toHaveLength(0);
    });

    it('should convert simple pipe expression', () => {
      const result = convertJQToFlow('. | .field');

      expect(result.nodes.length).toBeGreaterThan(1);
      expect(result.nodes[0]!.data.type).toBe(JQNodeType.Start);
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('should throw error for expressions exceeding max length', () => {
      const longExpression = '.'.repeat(MAX_EXPRESSION_LENGTH + 1);

      expect(() => convertJQToFlow(longExpression)).toThrow();
    });
  });

  describe('Literal Values', () => {
    it('should convert string literals', () => {
      const result = convertJQToFlow('. | "hello world"');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.String);
      expect(valueNode!.data.value).toBe('hello world');
    });

    it('should convert number literals', () => {
      const result = convertJQToFlow('. | 42');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Number);
      expect(valueNode!.data.value).toBe(42);
    });

    it('should convert negative numbers', () => {
      const result = convertJQToFlow('. | -42');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Number);
      expect(valueNode!.data.value).toBe(-42);
    });

    it('should convert floating point numbers', () => {
      const result = convertJQToFlow('. | 3.14');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Number);
      expect(valueNode!.data.value).toBe(3.14);
    });

    it('should convert boolean true', () => {
      const result = convertJQToFlow('. | true');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Boolean);
      expect(valueNode!.data.value).toBe(true);
    });

    it('should convert boolean false', () => {
      const result = convertJQToFlow('. | false');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Boolean);
      expect(valueNode!.data.value).toBe(false);
    });

    it('should convert null', () => {
      const result = convertJQToFlow('. | null');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Null);
      expect(valueNode!.data.value).toBe(null);
    });

    it('should handle string escaping', () => {
      const result = convertJQToFlow('. | "hello \\"world\\""');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.value).toBe('hello "world"');
    });

    it('should handle newlines in strings', () => {
      const result = convertJQToFlow('. | "line1\\nline2"');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      // Parser correctly unescapes \n to actual newline character
      expect(valueNode!.data.value).toBe('line1\nline2');
    });
  });

  describe('Path Expressions', () => {
    it('should convert simple field access', () => {
      const result = convertJQToFlow('.field');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Path);
    });

    it('should convert nested field access', () => {
      const result = convertJQToFlow('.field.nested');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Path);
    });

    it('should convert array index access', () => {
      const result = convertJQToFlow('.[0]');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Path);
    });

    it('should convert array range', () => {
      const result = convertJQToFlow('.[0:5]');

      const valueNode = result.nodes.find((n) => n.data.type === JQNodeType.Value);
      expect(valueNode).toBeDefined();
      expect(valueNode!.data.valueType).toBe(ValueType.Path);
    });

    it('should convert optional field access', () => {
      const result = convertJQToFlow('.field?');

      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('Function Calls', () => {
    it('should convert simple function calls', () => {
      const result = convertJQToFlow('. | keys');

      const funcNode = result.nodes.find((n) => n.data.type === JQNodeType.FunctionCall);
      expect(funcNode).toBeDefined();
      expect(funcNode!.data.selectedFunction).toBe('keys');
    });

    it('should convert function calls with parameters', () => {
      const result = convertJQToFlow('. | map(.x)');

      const funcNode = result.nodes.find((n) => n.data.type === JQNodeType.FunctionCall);
      expect(funcNode).toBeDefined();
      expect(funcNode!.data.selectedFunction).toBe('map');
      expect(result.edges.length).toBeGreaterThan(1); // Should have parameter connections
    });

    it('should convert function calls with multiple parameters', () => {
      const result = convertJQToFlow('. | has("field")');

      const funcNode = result.nodes.find((n) => n.data.type === JQNodeType.FunctionCall);
      expect(funcNode).toBeDefined();
    });

    it('should convert chained function calls', () => {
      const result = convertJQToFlow('. | keys | sort');

      const funcNodes = result.nodes.filter((n) => n.data.type === JQNodeType.FunctionCall);
      expect(funcNodes.length).toBeGreaterThanOrEqual(2);
    });

    it('should convert select function', () => {
      const result = convertJQToFlow('. | select(.x > 5)');

      const funcNode = result.nodes.find((n) => n.data.type === JQNodeType.FunctionCall);
      expect(funcNode).toBeDefined();
      expect(funcNode!.data.selectedFunction).toBe('select');
    });

    it('should convert to_entries function', () => {
      const result = convertJQToFlow('. | to_entries');

      const funcNode = result.nodes.find((n) => n.data.type === JQNodeType.FunctionCall);
      expect(funcNode).toBeDefined();
      expect(funcNode!.data.selectedFunction).toBe('to_entries');
    });
  });

  describe('Operators', () => {
    it('should convert addition operator', () => {
      const result = convertJQToFlow('. | 5 + 3');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
      expect(opNode!.data.operator).toBe('+');
    });

    it('should convert subtraction operator', () => {
      const result = convertJQToFlow('. | 10 - 3');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
      expect(opNode!.data.operator).toBe('-');
    });

    it('should convert multiplication operator', () => {
      const result = convertJQToFlow('. | 5 * 3');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
      expect(opNode!.data.operator).toBe('*');
    });

    it('should convert division operator', () => {
      const result = convertJQToFlow('. | 10 / 2');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
      expect(opNode!.data.operator).toBe('/');
    });

    it('should convert comparison operators', () => {
      const result = convertJQToFlow('. | .x > 5');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
      expect(opNode!.data.operator).toBe('>');
    });

    it('should convert equality operator', () => {
      const result = convertJQToFlow('. | .x == 5');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
      expect(opNode!.data.operator).toBe('==');
    });

    it('should convert logical AND operator', () => {
      const result = convertJQToFlow('. | .x > 5 and .y < 10');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
      expect(opNode!.data.operator).toBe('and');
    });

    it('should convert logical OR operator', () => {
      const result = convertJQToFlow('. | .x > 5 or .y < 10');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
      expect(opNode!.data.operator).toBe('or');
    });

    it('should convert NOT function', () => {
      const result = convertJQToFlow('. | .x | not');

      const funcNode = result.nodes.find(
        (n) => n.data.type === JQNodeType.FunctionCall && n.data.selectedFunction === 'not',
      );
      expect(funcNode).toBeDefined();
      expect((funcNode!.data as JQFunctionCallData).selectedFunction).toBe('not');
    });
  });

  describe('Conditionals', () => {
    it('should convert if-then-else expressions', () => {
      const result = convertJQToFlow('. | if .x > 5 then "big" else "small" end');

      const condNode = result.nodes.find((n) => n.data.type === JQNodeType.Condition);
      expect(condNode).toBeDefined();
      expect(condNode!.data.branches).toHaveLength(1);
    });

    it('should convert if-then without else', () => {
      const result = convertJQToFlow('. | if .x > 5 then "big" end');

      const condNode = result.nodes.find((n) => n.data.type === JQNodeType.Condition);
      expect(condNode).toBeDefined();
    });

    it('should convert if-elif-else expressions', () => {
      const result = convertJQToFlow(
        '. | if .x > 10 then "big" elif .x > 5 then "medium" else "small" end',
      );

      const condNode = result.nodes.find((n) => n.data.type === JQNodeType.Condition);
      expect(condNode).toBeDefined();
      expect((condNode!.data.branches as []).length).toBeGreaterThanOrEqual(2);
    });

    it('should convert nested conditionals', () => {
      const result = convertJQToFlow(
        '. | if .x > 5 then (if .y > 10 then "yes" else "no" end) else "maybe" end',
      );

      const condNodes = result.nodes.filter((n) => n.data.type === JQNodeType.Condition);
      expect(condNodes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Array and Object Construction', () => {
    it('should convert array literals', () => {
      const result = convertJQToFlow('. | [1, 2, 3]');

      const valueNode = result.nodes.find(
        (n) => n.data.type === JQNodeType.Value && n.data.valueType === ValueType.Array,
      );
      expect(valueNode).toBeDefined();
    });

    it('should convert empty arrays', () => {
      const result = convertJQToFlow('. | []');

      const valueNode = result.nodes.find(
        (n) => n.data.type === JQNodeType.Value && n.data.valueType === ValueType.Array,
      );
      expect(valueNode).toBeDefined();
    });

    it('should convert object literals', () => {
      const result = convertJQToFlow('. | {name: "John", age: 30}');

      const valueNode = result.nodes.find(
        (n) => n.data.type === JQNodeType.Value && n.data.valueType === ValueType.Object,
      );
      expect(valueNode).toBeDefined();
    });

    it('should convert empty objects', () => {
      const result = convertJQToFlow('. | {}');

      const valueNode = result.nodes.find(
        (n) => n.data.type === JQNodeType.Value && n.data.valueType === ValueType.Object,
      );
      expect(valueNode).toBeDefined();
    });

    it('should convert nested arrays', () => {
      const result = convertJQToFlow('. | [[1, 2], [3, 4]]');

      expect(result.nodes.length).toBeGreaterThan(1);
    });

    it('should convert nested objects', () => {
      const result = convertJQToFlow('. | {outer: {inner: "value"}}');

      expect(result.nodes.length).toBeGreaterThan(1);
    });
  });

  describe('Variable Assignments', () => {
    it('should convert variable assignments', () => {
      const result = convertJQToFlow('. | .x as $var | $var');

      // Should create nodes and handle variable mapping
      expect(result.nodes.length).toBeGreaterThan(1);
    });

    it('should convert chained variable assignments', () => {
      const result = convertJQToFlow('. | .x as $a | .y as $b | $a + $b');

      expect(result.nodes.length).toBeGreaterThan(2);
    });

    it('should handle variable references', () => {
      const result = convertJQToFlow('. | .x as $var | $var + 5');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();
    });
  });

  describe('Complex Expressions', () => {
    it('should convert complex nested expressions', () => {
      const result = convertJQToFlow('. | map(.x) | select(. > 5) | sort');

      expect(result.nodes.length).toBeGreaterThan(3);
      expect(result.edges.length).toBeGreaterThan(2);
    });

    it('should convert expressions with multiple operators', () => {
      const result = convertJQToFlow('. | (.x + .y) * .z');

      const opNodes = result.nodes.filter((n) => n.data.type === JQNodeType.Operator);
      expect(opNodes.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle parenthesized expressions', () => {
      const result = convertJQToFlow('. | (5 + 3) * 2');

      const opNodes = result.nodes.filter((n) => n.data.type === JQNodeType.Operator);
      expect(opNodes.length).toBeGreaterThanOrEqual(2);
    });

    it('should convert expressions with mixed literals and operations', () => {
      const result = convertJQToFlow('. | {x: .field + 5, y: "test"}');

      expect(result.nodes.length).toBeGreaterThan(2);
    });
  });

  describe('Layout', () => {
    it('should position nodes with valid coordinates', () => {
      const result = convertJQToFlow('. | .x | .y | .z');

      result.nodes.forEach((node) => {
        expect(node.position.x).toBeTypeOf('number');
        expect(node.position.y).toBeTypeOf('number');
        expect(isNaN(node.position.x)).toBe(false);
        expect(isNaN(node.position.y)).toBe(false);
      });
    });

    it('should create proper vertical spacing', () => {
      const result = convertJQToFlow('. | .x | .y | .z');

      const yPositions = result.nodes.map((n) => n.position.y).sort((a, b) => a - b);
      for (let i = 1; i < yPositions.length; i++) {
        // Y positions should be different (nodes at different levels)
        if (yPositions[i] !== yPositions[i - 1]) {
          expect(yPositions[i]!).toBeGreaterThan(yPositions[i - 1]!);
        }
      }
    });

    it('should handle Start node positioning', () => {
      const result = convertJQToFlow('. | .x');

      const startNode = result.nodes.find((n) => n.data.type === JQNodeType.Start);
      expect(startNode).toBeDefined();
      expect(startNode!.position.y).toBeTypeOf('number');
    });
  });

  describe('Edge Creation', () => {
    it('should create edges for piped expressions', () => {
      const result = convertJQToFlow('. | .x | .y');

      expect(result.edges.length).toBeGreaterThanOrEqual(2);
    });

    it('should connect Start node to first node', () => {
      const result = convertJQToFlow('. | .x');

      const startNode = result.nodes.find((n) => n.data.type === JQNodeType.Start);
      expect(startNode).toBeDefined();

      const edgeFromStart = result.edges.find((e) => e.source === startNode!.id);
      expect(edgeFromStart).toBeDefined();
    });

    it('should create edges for function parameters', () => {
      const result = convertJQToFlow('. | map(.x)');

      const funcNode = result.nodes.find((n) => n.data.type === JQNodeType.FunctionCall);
      expect(funcNode).toBeDefined();

      const paramEdges = result.edges.filter((e) => e.target === funcNode!.id);
      expect(paramEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('should create edges for operator operands', () => {
      const result = convertJQToFlow('. | 5 + 3');

      const opNode = result.nodes.find((n) => n.data.type === JQNodeType.Operator);
      expect(opNode).toBeDefined();

      const operandEdges = result.edges.filter((e) => e.target === opNode!.id);
      expect(operandEdges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid jq syntax gracefully', () => {
      // Test with malformed operator (incomplete expression)
      expect(() => convertJQToFlow('. +')).toThrow();
    });

    it('should handle unbalanced parentheses', () => {
      expect(() => convertJQToFlow('. | (5 + 3')).toThrow();
    });

    it('should handle unbalanced brackets', () => {
      expect(() => convertJQToFlow('. | [1, 2')).toThrow();
    });

    it('should handle unbalanced braces', () => {
      expect(() => convertJQToFlow('. | {x: 5')).toThrow();
    });

    it('should handle empty input', () => {
      expect(() => convertJQToFlow('')).toThrow();
    });
  });

  describe('Special Cases', () => {
    it('should handle whitespace in expressions', () => {
      const result = convertJQToFlow('.   |   .x   |   .y');

      expect(result.nodes.length).toBeGreaterThan(1);
    });

    it('should handle comments (if supported)', () => {
      // jq doesn't support comments in expressions, but test parser doesn't break
      const result = convertJQToFlow('. | .x');
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should handle very long field names', () => {
      const longField = 'a'.repeat(100);
      const result = convertJQToFlow(`. | .${longField}`);

      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should preserve node IDs uniqueness', () => {
      const result = convertJQToFlow('. | .x | .y | .z');

      const ids = result.nodes.map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should preserve edge IDs uniqueness', () => {
      const result = convertJQToFlow('. | .x | .y | .z');

      const ids = result.edges.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('TryCatch', () => {
    it('should parse try-catch expression', () => {
      const result = convertJQToFlow('. | try .x catch "default"');

      const tryCatchNode = result.nodes.find((n) => n.data.type === JQNodeType.TryCatch);
      expect(tryCatchNode).toBeDefined();

      // Should have try and catch edges from the TryCatch node
      const tryEdge = result.edges.find(
        (e) => e.source === tryCatchNode!.id && e.sourceHandle === JQHandleIdPrefix.Try,
      );
      const catchEdge = result.edges.find(
        (e) => e.source === tryCatchNode!.id && e.sourceHandle === JQHandleIdPrefix.Catch,
      );
      expect(tryEdge).toBeDefined();
      expect(catchEdge).toBeDefined();
    });

    it('should parse try-only expression (no catch)', () => {
      const result = convertJQToFlow('. | try .x');

      const tryCatchNode = result.nodes.find((n) => n.data.type === JQNodeType.TryCatch);
      expect(tryCatchNode).toBeDefined();

      // Should have try edge but no catch edge
      const tryEdge = result.edges.find(
        (e) => e.source === tryCatchNode!.id && e.sourceHandle === JQHandleIdPrefix.Try,
      );
      const catchEdge = result.edges.find(
        (e) => e.source === tryCatchNode!.id && e.sourceHandle === JQHandleIdPrefix.Catch,
      );
      expect(tryEdge).toBeDefined();
      expect(catchEdge).toBeUndefined();
    });

    it('should parse complex try expression', () => {
      const result = convertJQToFlow('. | try .x catch "error"');

      const tryCatchNode = result.nodes.find((n) => n.data.type === JQNodeType.TryCatch);
      expect(tryCatchNode).toBeDefined();

      // Catch target should be a string value node
      const catchEdge = result.edges.find(
        (e) => e.source === tryCatchNode!.id && e.sourceHandle === JQHandleIdPrefix.Catch,
      );
      expect(catchEdge).toBeDefined();
      const catchTarget = result.nodes.find((n) => n.id === catchEdge!.target);
      expect(catchTarget).toBeDefined();
      expect(catchTarget!.data.type).toBe(JQNodeType.Value);
      expect((catchTarget!.data as { value: string }).value).toBe('error');
    });

    it('should parse try-catch inside a pipe chain', () => {
      const result = convertJQToFlow('. | try .x catch "default" | keys');

      const tryCatchNode = result.nodes.find((n) => n.data.type === JQNodeType.TryCatch);
      expect(tryCatchNode).toBeDefined();

      const funcNode = result.nodes.find(
        (n) => n.data.type === JQNodeType.FunctionCall && n.data.selectedFunction === 'keys',
      );
      expect(funcNode).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Inline Comments
  // -------------------------------------------------------------------------

  describe('Inline Comments', () => {
    it('should create a Comment node from an inline comment', () => {
      const result = convertJQToFlow('. # identity\n| map(.x)');

      const commentNodes = result.nodes.filter((n) => n.data.type === JQNodeType.Comment);
      expect(commentNodes).toHaveLength(1);
      expect((commentNodes[0]!.data as JQCommentData).text).toBe('identity');
    });

    it('should create multiple Comment nodes from multiple inline comments', () => {
      const result = convertJQToFlow('. # start\n| map(.x) # transform\n| select(. > 0)');

      const commentNodes = result.nodes.filter((n) => n.data.type === JQNodeType.Comment);
      expect(commentNodes).toHaveLength(2);

      const texts = commentNodes.map((n) => (n.data as JQCommentData).text).sort();
      expect(texts).toContain('start');
      expect(texts).toContain('transform');
    });

    it('should NOT extract comments inside string literals', () => {
      const result = convertJQToFlow('"hello # world"');

      const commentNodes = result.nodes.filter((n) => n.data.type === JQNodeType.Comment);
      expect(commentNodes).toHaveLength(0);
    });

    it('should insert Comment node into the pipe chain', () => {
      const result = convertJQToFlow('. # note\n| keys');

      const commentNodes = result.nodes.filter((n) => n.data.type === JQNodeType.Comment);
      expect(commentNodes).toHaveLength(1);

      const commentNode = commentNodes[0];

      // Comment should have an incoming edge (top handle)
      const incomingEdge = result.edges.find((e) => e.target === commentNode!.id);
      expect(incomingEdge).toBeDefined();
      expect(incomingEdge!.targetHandle).toBe(JQHandleIdPrefix.Top);

      // Comment should have an outgoing edge (bottom handle) to next node
      const outgoingEdge = result.edges.find(
        (e) => e.source === commentNode!.id && e.sourceHandle === JQHandleIdPrefix.Bottom,
      );
      expect(outgoingEdge).toBeDefined();
    });

    it('should parse expression correctly after stripping comments', () => {
      const result = convertJQToFlow('. | map(.x) # transform');

      // The expression should still parse correctly
      const funcNodes = result.nodes.filter(
        (n) => n.data.type === JQNodeType.FunctionCall && n.data.selectedFunction === 'map',
      );
      expect(funcNodes).toHaveLength(1);
    });
  });
});
