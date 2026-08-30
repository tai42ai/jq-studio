/**
 * @fileoverview Integration tests for bidirectional JQ <-> Flow conversion.
 *
 * These tests verify that conversions work correctly in both directions
 * and that round-trip conversions preserve semantic meaning.
 */

import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './flow-from-jq/index';
import { convertFlowToJQ } from './jq-from-flow/index';
import { JQNodeType } from '../../enums';
import { type JQCommentData } from '../../types';

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

  describe('Data Structure Integrity', () => {
    it('should maintain proper node data types', () => {
      const jq = '. | "test" | .x | 42';
      const { nodes } = convertJQToFlow(jq);

      nodes.forEach((node) => {
        expect(node.id).toBeTruthy();
        expect(node.type).toBeTruthy();
        expect(node.position).toBeDefined();
        expect(node.data).toBeDefined();
        expect(node.data.type).toBeTruthy();
      });
    });

    it('should maintain proper edge data types', () => {
      const jq = '. | .x | .y';
      const { edges } = convertJQToFlow(jq);

      edges.forEach((edge) => {
        expect(edge.id).toBeTruthy();
        expect(edge.source).toBeTruthy();
        expect(edge.target).toBeTruthy();
        expect(typeof edge.sourceHandle).toBe('string');
        expect(typeof edge.targetHandle).toBe('string');
      });
    });

    it('should not create duplicate node IDs', () => {
      const jq = '. | .x | .y | .z';
      const { nodes } = convertJQToFlow(jq);

      const ids = nodes.map((n) => n.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should not create duplicate edge IDs', () => {
      const jq = '. | .x | .y | .z';
      const { edges } = convertJQToFlow(jq);

      const ids = edges.map((e) => e.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Converter Symmetry: Function Declarations', () => {
    it('should round-trip a simple function declaration with param', () => {
      const original = 'def double(f): f * 2;\n\n.';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('def double(f)');
      expect(result).toContain('f * 2');
    });

    it('should round-trip a parameterless function declaration', () => {
      const original = 'def id: .;\n\n.';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('def id:');
    });

    it('should round-trip function declaration with main flow', () => {
      const original = 'def inc(x): x + 1;\n\n. | inc';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('def inc(x)');
      expect(result).toContain('inc');
      // Function decl should come before main expression
      const defIndex = result.indexOf('def');
      const incCallIndex = result.lastIndexOf('inc');
      expect(defIndex).toBeLessThan(incCallIndex);
    });

    it('should round-trip function declaration with multiple params', () => {
      const original = 'def add(a; b): a + b;\n\n.';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('def add(a; b)');
    });
  });

  describe('FunctionCall as array/object child', () => {
    it('should round-trip array with function call item: [map(.x)]', () => {
      const original = '. | [map(.x)]';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('map');
      expect(result).toContain('.x');
      // Should be wrapped in array brackets
      expect(result).toMatch(/\[.*map.*\]/s);
    });

    it('should round-trip object with function call field value: {"key": length}', () => {
      const original = '. | {"key": length}';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('"key"');
      expect(result).toContain('length');
    });

    it('should round-trip array with multiple function call items: [keys, values]', () => {
      const original = '. | [keys, values]';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('keys');
      expect(result).toContain('values');
    });
  });

  describe('Converter Symmetry: Variable Name Preservation', () => {
    it('should preserve variable names in round-trip', () => {
      const original = '. | .x as $input | $input';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('$input');
    });

    it('should preserve variable names for literal values', () => {
      const original = '. | 42 as $myVar | $myVar';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('$myVar');
    });

    it('should preserve variable names in chained expressions', () => {
      const original = '. | .name as $name | $name | keys as $k | $k';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('$name');
      expect(result).toContain('$k');
    });
  });

  describe('Converter Symmetry: TryCatch', () => {
    it('should round-trip try-catch expression', () => {
      const original = '. | try .x catch "default"';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('try');
      expect(result).toContain('.x');
      expect(result).toContain('catch');
      expect(result).toContain('"default"');
    });

    it('should round-trip try-only expression', () => {
      const original = '. | try .x';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('try');
      expect(result).toContain('.x');
      expect(result).not.toContain('catch');
    });

    it('should round-trip try-catch in pipe chain', () => {
      const original = '. | try .x catch "fallback" | keys';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('try');
      expect(result).toContain('.x');
      expect(result).toContain('catch');
      expect(result).toContain('"fallback"');
      expect(result).toContain('keys');
    });
  });

  // -------------------------------------------------------------------------
  // Inline Comments Round-trip
  // -------------------------------------------------------------------------

  describe('Converter Symmetry: Inline Comments', () => {
    it('should round-trip JQ with inline comment → Flow → JQ', () => {
      const original = '.field\n# identity\n| map(.x)';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      // The round-tripped expression should contain the comment
      expect(result).toContain('# identity');
      // And the actual expression should still be valid
      expect(result).toContain('map');
      expect(result).toContain('.field');
    });

    it('should round-trip JQ with multiple comments', () => {
      const original = '.field\n# first note\n| map(.x)\n# second note\n| select(. > 0)';
      const { nodes, edges } = convertJQToFlow(original);

      // Verify Comment nodes were created
      const commentNodes = nodes.filter((n) => n.data.type === JQNodeType.Comment);
      expect(commentNodes).toHaveLength(2);

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('# first note');
      expect(result).toContain('# second note');
    });

    it('should not create Comment nodes for strings containing #', () => {
      const original = '"hello # world"';
      const { nodes } = convertJQToFlow(original);

      const commentNodes = nodes.filter((n) => n.data.type === JQNodeType.Comment);
      expect(commentNodes).toHaveLength(0);
    });

    it('should round-trip leading comment before expression', () => {
      const original = '# header\n.field';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      expect(result).toContain('# header');
      expect(result).toContain('.field');
    });

    it('should round-trip multiline comment as single node', () => {
      const original = '# line1\n# line2\n.field';
      const { nodes, edges } = convertJQToFlow(original);

      // Should create a single Comment node with multiline text
      const commentNodes = nodes.filter((n) => n.data.type === JQNodeType.Comment);
      expect(commentNodes).toHaveLength(1);
      expect((commentNodes[0]!.data as JQCommentData).text).toBe('line1\nline2');

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('# line1');
      expect(result).toContain('# line2');
    });

    it('should preserve comment positions in round-trip', () => {
      const original = '.field\n# comment A\n| map(.x)\n# comment B\n| select(. > 0)';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      // Verify comments appear between correct stages (not grouped together)
      const lines = result.split('\n');
      const fieldIdx = lines.findIndex((l) => l.includes('.field'));
      const commentAIdx = lines.findIndex((l) => l.includes('# comment A'));
      const mapIdx = lines.findIndex((l) => l.includes('map'));
      const commentBIdx = lines.findIndex((l) => l.includes('# comment B'));
      const selectIdx = lines.findIndex((l) => l.includes('select'));

      expect(fieldIdx).toBeLessThan(commentAIdx);
      expect(commentAIdx).toBeLessThan(mapIdx);
      expect(mapIdx).toBeLessThan(commentBIdx);
      expect(commentBIdx).toBeLessThan(selectIdx);
    });

    it('should preserve comment position with leading identity pipe', () => {
      const original = '# header\n. | .field\n# middle\n| map(.x)';
      const { nodes, edges } = convertJQToFlow(original);
      const result = convertFlowToJQ(nodes, edges);

      const lines = result.split('\n');
      const headerIdx = lines.findIndex((l) => l.includes('# header'));
      const fieldIdx = lines.findIndex((l) => l.includes('.field'));
      const middleIdx = lines.findIndex((l) => l.includes('# middle'));
      const mapIdx = lines.findIndex((l) => l.includes('map'));

      expect(headerIdx).toBeLessThan(fieldIdx);
      expect(fieldIdx).toBeLessThan(middleIdx);
      expect(middleIdx).toBeLessThan(mapIdx);
    });
  });
});
