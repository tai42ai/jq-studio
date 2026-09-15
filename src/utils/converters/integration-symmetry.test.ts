/**
 * @fileoverview Converter-symmetry integration tests: data structures, declarations, variables, try/catch and inline comments.
 */

import { describe, expect, it } from 'vitest';

import { JQNodeType } from '../../enums';
import { type JQCommentData } from '../../types';
import { convertJQToFlow } from './flow-from-jq/index';
import { convertFlowToJQ } from './jq-from-flow/index';

describe('Bidirectional Conversion Integration Tests', () => {
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
