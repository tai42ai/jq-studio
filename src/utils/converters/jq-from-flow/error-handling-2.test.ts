/**
 * @fileoverview Tests for convertFlowToJQ error handling.
 */

import { describe, expect, it } from 'vitest';

import { JQHandleIdPrefix } from '../../../enums';
import { createChainEdge, createCommentNode, createFunctionDeclNode } from '../test-helpers';
import { cond, edge, flow, func, num, op, start, str, tryCatch } from './flow-fixtures';
import { convertFlowToJQ } from './index';

describe('convertFlowToJQ', () => {
  describe('Error Handling', () => {
    it('should throw error if a functions edge targets a node that is not a declaration', () => {
      // The functions handle only ever accepts a FunctionDecl, so any other node type
      // there is a graph no editor could have drawn.
      const nodes = [start(), str('v1', 'hello', 'val')];
      const edges = [edge('e1', 'start', 'v1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top)];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Start node start functions edge e1 targets jqValue node v1 — the functions handle accepts FunctionDecl nodes only/,
      );
    });

    it('should throw error if a FunctionDecl logic edge targets a missing node', () => {
      // A declaration with no logic edge is the identity function; one whose logic edge
      // dangles has a body the graph lost, and `.` would define the wrong function.
      const nodes = [start(), createFunctionDeclNode('fd1', [], { name: 'my_func' })];
      const edges = [
        edge('e1', 'start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
        edge('e2', 'fd1', 'ghost', JQHandleIdPrefix.Logic, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source fd1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a main chain bottom edge targets a missing node', () => {
      // The chain carries on past the node, so ending the walk there would emit an
      // expression that stops short of everything the flow draws after it.
      const nodes = [start(), num('n1', 7, '')];
      const edges = [flow('e1', 'start', 'n1'), createChainEdge('e2', 'n1', 'ghost')];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source n1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a main chain comment bottom edge targets a missing node', () => {
      // A comment hands the chain on the same way any other node does, so a dangling
      // hop out of one truncates the chain just as silently.
      const nodes = [start(), num('n1', 7, ''), createCommentNode('c1', 'note')];
      const edges = [
        flow('e1', 'start', 'n1'),
        createChainEdge('e2', 'n1', 'c1'),
        createChainEdge('e3', 'c1', 'ghost'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source c1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a param chain bottom edge targets a missing node', () => {
      // The parameter is the whole chain hanging off the param handle, so a cut hop
      // would pass the call an argument the flow never drew.
      const nodes = [start(), func('fc1', 'map', { name: '' }), num('n1', 7, '')];
      const edges = [
        flow('e1', 'start', 'fc1'),
        edge('e2', 'fc1', 'n1', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
        createChainEdge('e3', 'n1', 'ghost'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source n1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a param chain comment bottom edge targets a missing node', () => {
      // Same cut, reached through a comment inside the parameter chain.
      const nodes = [
        start(),
        func('fc1', 'map', { name: '' }),
        num('n1', 7, ''),
        createCommentNode('c1', 'note'),
      ];
      const edges = [
        flow('e1', 'start', 'fc1'),
        edge('e2', 'fc1', 'n1', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
        createChainEdge('e3', 'n1', 'c1'),
        createChainEdge('e4', 'c1', 'ghost'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e4: source c1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a branch chain bottom edge targets a missing node', () => {
      // The try branch is the chain hanging off the try handle, so a cut hop would
      // guard less of the expression than the flow puts inside the `try`.
      const nodes = [start(), tryCatch('tc1', ''), num('n1', 7, '')];
      const edges = [
        flow('e1', 'start', 'tc1'),
        edge('e2', 'tc1', 'n1', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
        createChainEdge('e3', 'n1', 'ghost'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source n1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a branch chain comment bottom edge targets a missing node', () => {
      // Same cut, reached through a comment inside the branch chain.
      const nodes = [
        start(),
        tryCatch('tc1', ''),
        num('n1', 7, ''),
        createCommentNode('c1', 'note'),
      ];
      const edges = [
        flow('e1', 'start', 'tc1'),
        edge('e2', 'tc1', 'n1', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
        createChainEdge('e3', 'n1', 'c1'),
        createChainEdge('e4', 'c1', 'ghost'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e4: source c1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a containing-operator edge targets a missing node', () => {
      // An operand shared by nested operators carries one edge per operator it feeds.
      // Dropping an edge that resolves to nothing would emit the operand as the
      // innermost operator alone, unwrapping the operators nested around it.
      // The flow enters at the outer operator so the walk reaches the containing-operator
      // hop directly, rather than through the outermost-operator search that reads the
      // same dangling edge one step earlier.
      const nodes = [
        start(),
        num('x', 1, ''),
        num('y', 2, ''),
        num('z', 3, ''),
        op('opInner', '>=', ''),
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
        edge(
          'e4',
          'y',
          'opInner',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorRight,
        ),
        edge(
          'e5',
          'y',
          'ghost',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorRight,
        ),
        edge(
          'e6',
          'z',
          'opOuter',
          `${JQHandleIdPrefix.OperatorLeft}:z`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e5: source y, target ghost — target not in graph/,
      );
    });

    it('should throw error if an inner-operator edge targets a missing node', () => {
      // An operand's operator edges run innermost-first, so the edge before the one
      // reaching this operator names the operator nested inside it. Falling back to the
      // raw operand answered `(1 + 2)` — the `+` applied straight to the value, with the
      // nested operator gone.
      const nodes = [start(), op('op1', '+', ''), num('x', 1, ''), num('y', 2, '')];
      const edges = [
        flow('e1', 'start', 'op1'),
        edge(
          'e2',
          'x',
          'ghost',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e3',
          'x',
          'op1',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e4',
          'y',
          'op1',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source x, target ghost — target not in graph/,
      );
    });

    it('should throw error if an operand pipe-chain edge targets a missing node', () => {
      // The operand is the whole chain hanging off the value node, so a cut hop hands the
      // operator a shorter value than the flow draws: the chain truncated to `2` and the
      // conversion answered `(1 + 2)`.
      const nodes = [start(), num('x', 1, ''), num('y', 2, ''), op('op1', '+', '')];
      const edges = [
        flow('e1', 'start', 'x'),
        edge(
          'e2',
          'x',
          'op1',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        createChainEdge('e3', 'y', 'ghost'),
        edge(
          'e4',
          'y',
          'op1',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source y, target ghost — target not in graph/,
      );
    });

    it('should throw error if an operand operator edge targets a missing node', () => {
      // The outermost-operator search reads every operator an operand feeds. Skipping the
      // edge that resolved to nothing left `op1` as the only candidate, so the conversion
      // answered `(1 + 2)` — an expression missing the operator wrapped around it.
      const nodes = [start(), num('x', 1, ''), num('y', 2, ''), op('op1', '+', '')];
      const edges = [
        flow('e1', 'start', 'x'),
        edge(
          'e2',
          'x',
          'op1',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e3',
          'x',
          'ghost',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e4',
          'y',
          'op1',
          `${JQHandleIdPrefix.OperatorLeft}:y`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source x, target ghost — target not in graph/,
      );
    });

    it('should throw error if a Condition else edge targets a missing node', () => {
      // The else handle is optional, but an edge leaving it is not: dropping it answered
      // `if 1 then\n  2\nend`, which falls through to jq's implicit `else .` and hands
      // back the input where the flow draws an else branch.
      const nodes = [start(), cond('c1', [{ id: 'b0' }], ''), num('i1', 1, ''), num('t1', 2, '')];
      const edges = [
        flow('e1', 'start', 'c1'),
        edge('e2', 'c1', 'i1', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'c1', 't1', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
        edge('e4', 'c1', 'ghost', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e4: source c1, target ghost — target not in graph/,
      );
    });
  });
});
