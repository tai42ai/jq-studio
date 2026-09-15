/**
 * @fileoverview Tests for convertFlowToJQ error handling.
 */

import { describe, expect, it } from 'vitest';

import { JQHandleIdPrefix } from '../../../enums';
import { createChainEdge } from '../test-helpers';
import { cond, edge, flow, num, op, start, tryCatch } from './flow-fixtures';
import { convertFlowToJQ } from './index';

describe('convertFlowToJQ', () => {
  describe('Error Handling', () => {
    it('should throw error if a TryCatch try edge targets a missing node', () => {
      // The try handle must be connected, so an edge leaving it that resolves to nothing
      // leaves the construct nothing to guard.
      const nodes = [start(), tryCatch('tc1', 'tc')];
      const edges = [
        flow('e1', 'start', 'tc1'),
        edge('e2', 'tc1', 'ghost', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source tc1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a Condition if edge targets a missing node', () => {
      // A branch is the pair of an if and a then, so a dangling half of it leaves the
      // branch with no test to run.
      const nodes = [start(), cond('c1', [{ id: 'b0' }], ''), num('t1', 2, '')];
      const edges = [
        flow('e1', 'start', 'c1'),
        edge('e2', 'c1', 'ghost', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'c1', 't1', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source c1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a Condition then edge targets a missing node', () => {
      // The other half of the same pair: a branch with no value to yield.
      const nodes = [start(), cond('c1', [{ id: 'b0' }], ''), num('i1', 1, '')];
      const edges = [
        flow('e1', 'start', 'c1'),
        edge('e2', 'c1', 'i1', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'c1', 'ghost', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source c1, target ghost — target not in graph/,
      );
    });

    it('should throw error if an Operator left operand edge comes from a missing node', () => {
      // The operator is binary, so an operand edge whose source the graph does not
      // contain leaves the operator a side short.
      const nodes = [start(), op('op1', '+', ''), num('y', 2, '')];
      const edges = [
        flow('e1', 'start', 'op1'),
        edge(
          'e2',
          'ghost',
          'op1',
          `${JQHandleIdPrefix.OperatorRight}:ghost`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e3',
          'y',
          'op1',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source ghost, target op1 — source not in graph/,
      );
    });

    it('should throw error if an Operator right operand edge comes from a missing node', () => {
      // The same gap on the operator's other side.
      const nodes = [start(), op('op1', '+', ''), num('x', 1, '')];
      const edges = [
        flow('e1', 'start', 'op1'),
        edge(
          'e2',
          'x',
          'op1',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e3',
          'ghost',
          'op1',
          `${JQHandleIdPrefix.OperatorLeft}:ghost`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source ghost, target op1 — source not in graph/,
      );
    });

    it('should throw error if a chain edge comes from a missing node', () => {
      // A walk reads an edge from the node it leaves, so an edge whose SOURCE the graph
      // does not contain is one no walk ever looks at: the conversion answered `7` for a
      // graph drawing a hop out of a node that is not there. The whole edge list is
      // checked before anything is walked, so both ends are held to the same rule.
      const nodes = [start(), num('n1', 7, '')];
      const edges = [flow('e1', 'start', 'n1'), createChainEdge('e2', 'ghost', 'n1')];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source ghost, target n1 — source not in graph/,
      );
    });

    it('should report every dangling edge in one error', () => {
      // A conversion that stopped at the first broken edge a walk reached named one edge
      // per run, so a graph with several took a run each to repair. The check runs over
      // the whole edge list, so one run names them all — whichever end is missing.
      const nodes = [start(), num('n1', 7, '')];
      const edges = [
        flow('e1', 'start', 'n1'),
        createChainEdge('e2', 'n1', 'ghostA'),
        createChainEdge('e3', 'ghostB', 'n1'),
        createChainEdge('e4', 'ghostC', 'ghostD'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        'Graph contains 3 dangling edges — remove the edge or restore the node:\n' +
          '  edge e2: source n1, target ghostA — target not in graph\n' +
          '  edge e3: source ghostB, target n1 — source not in graph\n' +
          '  edge e4: source ghostC, target ghostD — source and target not in graph',
      );
    });

    it('should throw error if an operator edge leads from a node back to itself', () => {
      // An operator handle looping back to the node it leaves names no operator. The
      // search passed over the edge and found nothing, and the conversion answered `1` —
      // the bare value, with no operator at all.
      const nodes = [start(), num('x', 1, '')];
      const edges = [
        flow('e1', 'start', 'x'),
        edge('e2', 'x', 'x', `${JQHandleIdPrefix.OperatorRight}:x`, JQHandleIdPrefix.OperatorLeft),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Operand node x operator edge e2 targets itself/,
      );
    });

    it('should throw error if every operator in a chain is nested inside another', () => {
      // Exactly one operator in a chain is nested inside no other. Here `x` feeds opA
      // before opB, marking opA inner, and `z` reaches opB twice, marking opB inner too —
      // so no operator is left to wrap the rest. The conversion answered `(1 + 2)`,
      // dropping opB and everything it operates on.
      const nodes = [
        start(),
        num('x', 1, ''),
        num('y', 2, ''),
        num('z', 3, ''),
        op('opA', '+', ''),
        op('opB', '*', ''),
      ];
      const edges = [
        flow('e1', 'start', 'x'),
        edge(
          'e2',
          'x',
          'opA',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e3',
          'x',
          'opB',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e4',
          'y',
          'opA',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorRight,
        ),
        edge(
          'e5',
          'z',
          'opB',
          `${JQHandleIdPrefix.OperatorLeft}:z`,
          JQHandleIdPrefix.OperatorRight,
        ),
        edge(
          'e6',
          'z',
          'opB',
          `${JQHandleIdPrefix.OperatorLeft}:z`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Operator chain from node x has no outermost operator — every operator in it \(opA, opB\) is nested inside another/,
      );
    });

    it('should throw error if an operand reaches its own operator over a non-operator edge', () => {
      // The operand's list of operator edges carries the nesting order, so an operand
      // whose edge into the operator is missing from that list places the operator
      // nowhere on it. The operator was read as the innermost one and opInner — the
      // operator the list does hold — was dropped in silence: the conversion answered
      // `(2 and 3)` for a flow that draws `((2 * 5) and 3)`.
      const nodes = [
        start(),
        num('y', 2, ''),
        num('w', 5, ''),
        num('z', 3, ''),
        op('opInner', '*', ''),
        op('opOuter', 'and', ''),
      ];
      const edges = [
        flow('e1', 'start', 'opOuter'),
        // `y` reaches opOuter's left handle from its top handle, so this edge is not one
        // of y's operator edges.
        edge('e2', 'y', 'opOuter', JQHandleIdPrefix.Top, JQHandleIdPrefix.OperatorLeft),
        edge(
          'e3',
          'y',
          'opInner',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e4',
          'w',
          'opInner',
          `${JQHandleIdPrefix.OperatorLeft}:w`,
          JQHandleIdPrefix.OperatorRight,
        ),
        edge(
          'e5',
          'z',
          'opOuter',
          `${JQHandleIdPrefix.OperatorLeft}:z`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Operator node opOuter operand y reaches it over edge e2, which is not one of that node's operator edges \(e3\)/,
      );
    });

    it('should throw error if an operand reaches an operator over a non-operator edge', () => {
      // The nesting order is read off the operand's list of operator edges, so an operand
      // that reaches the operator over an edge missing from that list places it nowhere.
      // The search then started at the front of the list and read opBelow — nested INSIDE
      // opInner — as the operator containing it: the conversion answered
      // `((2 * 5) and 3)` for a flow that draws `((1 >= 2) and 3)`.
      const nodes = [
        start(),
        num('x', 1, ''),
        num('y', 2, ''),
        num('w', 5, ''),
        num('z', 3, ''),
        op('opInner', '>=', ''),
        op('opBelow', '*', ''),
        op('opOuter', 'and', ''),
      ];
      const edges = [
        flow('e1', 'start', 'opOuter'),
        edge(
          'e2',
          'x',
          'opInner',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e3',
          'x',
          'opOuter',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        // `y` reaches opInner's right handle from its top handle, so this edge is not one
        // of y's operator edges.
        edge('e4', 'y', 'opInner', JQHandleIdPrefix.Top, JQHandleIdPrefix.OperatorRight),
        edge(
          'e5',
          'y',
          'opBelow',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e6',
          'w',
          'opBelow',
          `${JQHandleIdPrefix.OperatorLeft}:w`,
          JQHandleIdPrefix.OperatorRight,
        ),
        edge(
          'e7',
          'z',
          'opOuter',
          `${JQHandleIdPrefix.OperatorLeft}:z`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Operator node opInner right operand y reaches it over edge e4, which is not one of that node's operator edges \(e5\)/,
      );
    });
  });
});
