// @vitest-environment node
/**
 * @fileoverview Direct tests for the operator-resolver contract guards.
 *
 * Both cases here are preconditions the converter's own call sites already meet —
 * `findOutermostOperator` runs only on a node carrying operator-handle edges, and
 * `findPipeChainEnd` runs on the same node right after the operand walk has already
 * followed its pipe chain. Neither guard is reachable through `convertFlowToJQ`,
 * so each is exercised against the function directly: a silent answer from either
 * would be an expression the flow does not draw, or a walk with no end.
 */

import { describe, it, expect } from 'vitest';
import { type JQNode, type JQEdge } from '../../../../types';
import { type ConversionContext } from '../types';
import { buildEdgeMaps } from './edge-classifier';
import { findOutermostOperator, findPipeChainEnd } from './operator-resolver';
import { createNumberNode, createChainEdge } from '../../test-helpers';

function makeContext(nodes: JQNode[], edges: JQEdge[]): ConversionContext {
  const { edgesByTarget, edgesBySource } = buildEdgeMaps(edges);
  return {
    nodes: new Map(nodes.map((node) => [node.id, node])),
    edges,
    edgesByTarget,
    edgesBySource,
    nodeExpressions: new Map(),
    variableNodes: new Set(),
    visited: new Set(),
    customFunctions: new Map(),
  };
}

describe('findOutermostOperator', () => {
  it('should throw when the node feeds no operator', () => {
    const node = createNumberNode('n1', 1, { name: '' });
    const context = makeContext([node], []);

    expect(() => findOutermostOperator('n1', context)).toThrow(/Node n1 feeds no operator/);
  });
});

describe('findPipeChainEnd', () => {
  it('should walk a pipe chain to the node that ends it', () => {
    const a = createNumberNode('a', 1, { name: '' });
    const b = createNumberNode('b', 2, { name: '' });
    const c = createNumberNode('c', 3, { name: '' });
    const context = makeContext(
      [a, b, c],
      [createChainEdge('e1', 'a', 'b'), createChainEdge('e2', 'b', 'c')],
    );

    expect(findPipeChainEnd(a, context).id).toBe('c');
  });

  it('should throw when the pipe chain loops back on itself', () => {
    const a = createNumberNode('a', 1, { name: '' });
    const b = createNumberNode('b', 2, { name: '' });
    const context = makeContext(
      [a, b],
      [createChainEdge('e1', 'a', 'b'), createChainEdge('e2', 'b', 'a')],
    );

    expect(() => findPipeChainEnd(a, context)).toThrow(
      /Chain cycle detected at node a — bottom edge e2 leads back to a node the chain already passed through/,
    );
  });
});
