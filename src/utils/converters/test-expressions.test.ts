// @vitest-environment node
/**
 * @fileoverview Validates test expressions: flow loading and round-trip execution.
 */

import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './flow-from-jq';
import { convertFlowToJQ } from './jq-from-flow';
import { execJq } from './test-helpers';
import testExpressions from './test-expressions.json';

describe('Test Expressions: all expressions load into flow', () => {
  for (const entry of testExpressions) {
    it(`should parse "${entry.name}"`, () => {
      const { nodes, edges } = convertJQToFlow(entry.expression);

      // Must produce at least a Start node
      expect(nodes.length).toBeGreaterThanOrEqual(1);

      // Start node must exist
      const startNode = nodes.find((n) => n.data.type === 'jqStart');
      expect(startNode).toBeDefined();

      // No duplicate node IDs
      const nodeIds = nodes.map((n) => n.id);
      expect(new Set(nodeIds).size).toBe(nodeIds.length);

      // All edges reference valid nodes
      const nodeIdSet = new Set(nodeIds);
      for (const edge of edges) {
        expect(nodeIdSet.has(edge.source)).toBe(true);
        expect(nodeIdSet.has(edge.target)).toBe(true);
      }
    });
  }
});

describe('Test Expressions: round-trip execution', () => {
  for (const entry of testExpressions) {
    it(`should produce correct output for "${entry.name}"`, async () => {
      // 1. JQ → Flow
      const { nodes, edges } = convertJQToFlow(entry.expression);

      // 2. Flow → JQ
      const outputExpr = convertFlowToJQ(nodes, edges);

      // 3. Execute against input via jq-web WASM
      let result: unknown;
      try {
        result = await execJq(outputExpr, JSON.parse(JSON.stringify(entry.input)));
      } catch (err) {
        throw new Error(`jq execution failed for:\n${outputExpr}\n\n${err}`);
      }

      // 4. Compare output to expected
      expect(result).toEqual(entry.expected_output);
    });
  }
});
