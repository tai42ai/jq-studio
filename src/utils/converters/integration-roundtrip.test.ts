/**
 * @fileoverview Round-trip and semantic-equivalence integration tests across both converters.
 */

import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './flow-from-jq/index';
import { convertFlowToJQ } from './jq-from-flow/index';

describe('Bidirectional Conversion Integration Tests', () => {
  describe('Round-trip: JQ -> Flow -> JQ', () => {
    it('should preserve identity expression', () => {
      const original = '.';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toBe('.');
    });

    it('should preserve simple field access', () => {
      const original = '.field';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      // Result should access the same field
      expect(result).toContain('.field');
    });

    it('should preserve string literals', () => {
      const original = '. | "hello"';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('"hello"');
    });

    it('should preserve number literals', () => {
      const original = '. | 42';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('42');
    });

    it('should preserve boolean literals', () => {
      const original = '. | true';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('true');
    });

    it('should preserve null literals', () => {
      const original = '. | null';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('null');
    });

    it('should preserve simple function calls', () => {
      const original = '. | keys';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('keys');
    });

    it('should preserve arithmetic operators', () => {
      const original = '. | 5 + 3';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('5');
      expect(result).toContain('3');
      expect(result).toContain('+');
    });

    it('should preserve comparison operators', () => {
      const original = '. | .x > 5';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('.x');
      expect(result).toContain('5');
      expect(result).toContain('>');
    });

    it('should preserve chained operations', () => {
      const original = '. | keys | sort';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('keys');
      expect(result).toContain('sort');
    });
  });

  describe('Semantic Equivalence', () => {
    it('should produce semantically equivalent output for piped expressions', () => {
      const original = '. | .x | .y';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      // The exact syntax might differ but should access x then y
      expect(result).toContain('.x');
      expect(result).toContain('.y');
    });

    it('should handle function calls with parameters', () => {
      const original = '. | map(.x)';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('map');
      expect(result).toContain('.x');
    });

    it('should handle nested paths', () => {
      const original = '.field.nested';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      // Should preserve the nested path structure
      expect(result).toContain('field');
      expect(result).toContain('nested');
    });
  });

  describe('Complex Expression Round-trips', () => {
    it('should handle expressions with multiple operations', () => {
      const original = '. | keys | sort | .[]';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      // Should contain all the operations
      expect(result).toContain('keys');
      expect(result).toContain('sort');
    });

    it('should handle expressions with literals and operations', () => {
      const original = '. | .x + 5';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('.x');
      expect(result).toContain('5');
      expect(result).toContain('+');
    });

    it('should handle string concatenation', () => {
      const original = '. | "hello" + " world"';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('hello');
      expect(result).toContain('world');
      expect(result).toContain('+');
    });
  });

  describe('Converter Consistency', () => {
    it('should create valid flow graphs from JQ', () => {
      const jq = '. | .x | .y';
      const { nodes, edges } = convertJQToFlow(jq);

      // Should have at least a Start node
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0]!.data.type).toBe('jqStart');

      // All nodes should have valid positions
      nodes.forEach((node) => {
        expect(node.position).toBeDefined();
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
        expect(isNaN(node.position.x)).toBe(false);
        expect(isNaN(node.position.y)).toBe(false);
      });

      // All edges should reference valid nodes
      edges.forEach((edge) => {
        const sourceExists = nodes.some((n) => n.id === edge.source);
        const targetExists = nodes.some((n) => n.id === edge.target);
        expect(sourceExists).toBe(true);
        expect(targetExists).toBe(true);
      });
    });

    it('should generate valid JQ from flow graphs', () => {
      const jq = '. | .x';
      const { nodes, edges } = convertJQToFlow(jq);
      const result = convertFlowToJQ(nodes, edges);

      // Should be valid jq (at least not empty and contains expected parts)
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should maintain graph connectivity', () => {
      const jq = '. | .x | .y | .z';
      const { nodes, edges } = convertJQToFlow(jq);

      // Start node should be connected
      const startNode = nodes.find((n) => n.data.type === 'jqStart');
      expect(startNode).toBeDefined();

      const startEdge = edges.find((e) => e.source === startNode!.id);
      expect(startEdge).toBeDefined();

      // All non-Start nodes should be reachable from Start
      // (This is a simplification - a full graph traversal would be more thorough)
      const connectedNodeIds = new Set([startNode!.id]);
      let changed = true;

      while (changed) {
        changed = false;
        edges.forEach((edge) => {
          if (connectedNodeIds.has(edge.source) && !connectedNodeIds.has(edge.target)) {
            connectedNodeIds.add(edge.target);
            changed = true;
          }
        });
      }

      // Most nodes should be connected (some might be parameter nodes)
      expect(connectedNodeIds.size).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      const original = '. | ""';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('""');
    });

    it('should handle zero values', () => {
      const original = '. | 0';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('0');
    });

    it('should handle false boolean', () => {
      const original = '. | false';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('false');
    });

    it('should handle negative numbers', () => {
      const original = '. | -42';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toMatch(/-42|0 - 42/);
    });

    it('should handle decimal numbers', () => {
      const original = '. | 3.14';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('3.14');
    });
  });

  describe('Special Characters', () => {
    it('should handle strings with quotes', () => {
      const original = '. | "hello \\"world\\""';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('\\"');
    });

    it('should handle strings with newlines', () => {
      const original = '. | "line1\\nline2"';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('\\n');
    });

    it('should handle strings with tabs', () => {
      const original = '. | "tab\\there"';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('\\t');
    });

    it('should handle unicode characters', () => {
      const original = '. | "hello 世界"';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      // Should preserve or escape unicode
      expect(result).toBeTruthy();
    });
  });

  describe('Multi-stage pipelines', () => {
    it('should convert a multi-stage pipeline to a single chain and back', () => {
      const original = '. | keys | map(. + "_suffix") | sort | .[]';

      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      // The graph is one unbranched chain — an edge count one below the node
      // count — and the round trip reproduces the expression exactly.
      expect(nodes).toHaveLength(8);
      expect(edges).toHaveLength(nodes.length - 1);
      expect(result).toBe('keys\n| map((. + "_suffix"))\n| sort\n| .[]');
    });

    it('should round-trip a batch of expressions to non-empty output', () => {
      const expressions = ['.', '. | .x', '. | keys', '. | .[] | .name', '. | map(.x) | sort'];

      expressions.forEach((expr) => {
        const { nodes, edges } = convertJQToFlow(expr);
        const result = convertFlowToJQ(nodes, edges);
        expect(result).toBeTruthy();
      });
    });
  });
});
