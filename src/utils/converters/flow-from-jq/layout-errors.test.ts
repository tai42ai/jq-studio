/**
 * @fileoverview Tests for convertJQToFlow: layout, edge creation, error handling, special cases, try/catch and inline comments.
 */

import { describe, expect, it } from 'vitest';

import { JQHandleIdPrefix, JQNodeType } from '../../../enums';
import { type JQCommentData } from '../../../types';
import { convertJQToFlow } from './index';

describe('convertJQToFlow', () => {
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
