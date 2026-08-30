// @vitest-environment node
/**
 * @fileoverview Direct tests for the two graph-size guards a conversion runs
 * before it walks anything.
 *
 * Neither is reachable through a drawn flow — the Studio always hands the
 * converter a canvas holding at least a Start node, and the node limit sits far
 * above any graph the editor produces — so each is exercised against the function
 * directly. A conversion that walked an empty graph would answer with a program
 * the flow never expressed, and one that walked an oversized graph would run for
 * as long as the graph is large.
 *
 * The same function's graph-integrity guard is reachable through a flow, so it is
 * covered end to end in `../index.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { validateInputs } from './validators';
import { MAX_GRAPH_NODES } from '../constants';
import { createNumberNode, createStartNode } from '../../test-helpers';

describe('validateInputs', () => {
  it('should reject a graph with no nodes', () => {
    expect(() => {
      validateInputs([], []);
    }).toThrow('Cannot convert empty graph to jq expression');
  });

  it('should reject a graph holding more nodes than the limit', () => {
    const nodes = [
      createStartNode(),
      ...Array.from({ length: MAX_GRAPH_NODES }, (_, i) => createNumberNode(`n${String(i)}`, i)),
    ];

    expect(nodes.length).toBe(MAX_GRAPH_NODES + 1);
    expect(() => {
      validateInputs(nodes, []);
    }).toThrow(`Graph exceeds the maximum of ${String(MAX_GRAPH_NODES)} nodes`);
  });

  it('should accept a graph holding exactly the limit', () => {
    const nodes = Array.from({ length: MAX_GRAPH_NODES }, (_, i) =>
      createNumberNode(`n${String(i)}`, i),
    );

    expect(() => {
      validateInputs(nodes, []);
    }).not.toThrow();
  });
});
