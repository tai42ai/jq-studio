/**
 * @fileoverview Tests for convertFlowToJQ: chain cycles, variable creation, edge cases, parameter sub-flows and function-call root inputs.
 */

import { describe, it, expect } from 'vitest';
import { convertFlowToJQ } from './index';
import { JQHandleIdPrefix } from '../../../enums';
import { createChainEdge } from '../test-helpers';
import {
  start,
  str,
  num,
  bool,
  path,
  arr,
  func,
  op,
  tryCatch,
  seg,
  flow,
  edge,
} from './flow-fixtures';

describe('convertFlowToJQ', () => {
  describe('Chain Cycles', () => {
    // A bottom-handle edge leading back to a node earlier in the same walk gives the
    // walk no end — without the guard it runs to heap exhaustion. Each walk rejects
    // the hop that closes the loop.

    it('should throw error if the main chain loops back on itself', () => {
      const nodes = [start(), num('a', 1, ''), num('b', 2, '')];
      const edges = [
        flow('e1', 'start', 'a'),
        createChainEdge('e2', 'a', 'b'),
        createChainEdge('e3', 'b', 'a'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Chain cycle detected at node a — bottom edge e3 leads back to a node the chain already passed through/,
      );
    });

    it('should throw error if a branch chain loops back on itself', () => {
      const nodes = [start(), tryCatch('tc1', ''), num('a', 1, ''), num('b', 2, '')];
      const edges = [
        flow('e1', 'start', 'tc1'),
        edge('e2', 'tc1', 'a', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
        createChainEdge('e3', 'a', 'b'),
        createChainEdge('e4', 'b', 'a'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Chain cycle detected at node a — bottom edge e4 leads back to a node the chain already passed through/,
      );
    });

    it('should throw error if a parameter chain loops back on itself', () => {
      const nodes = [start(), func('fc1', 'map', { name: '' }), num('a', 1, ''), num('b', 2, '')];
      const edges = [
        flow('e1', 'start', 'fc1'),
        edge('e2', 'fc1', 'a', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
        createChainEdge('e3', 'a', 'b'),
        createChainEdge('e4', 'b', 'a'),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Chain cycle detected at node a — bottom edge e4 leads back to a node the chain already passed through/,
      );
    });

    it('should throw error if an operand pipe chain loops back on itself', () => {
      // `x` is the operator's left operand, and the chain piped into it loops.
      const nodes = [
        start(),
        num('x', 1, ''),
        num('a', 2, ''),
        num('b', 3, ''),
        num('r', 4, ''),
        op('op1', '+', ''),
      ];
      const edges = [
        flow('e1', 'start', 'x'),
        createChainEdge('e2', 'x', 'a'),
        edge(
          'e3',
          'x',
          'op1',
          `${JQHandleIdPrefix.OperatorRight}:x`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        createChainEdge('e4', 'a', 'b'),
        createChainEdge('e5', 'b', 'a'),
        edge(
          'e6',
          'r',
          'op1',
          `${JQHandleIdPrefix.OperatorLeft}:r`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Chain cycle detected at node a — bottom edge e5 leads back to a node the chain already passed through/,
      );
    });
  });

  describe('Variable Creation', () => {
    it('should create variables for named FunctionCall nodes', () => {
      // Test that named function calls create variables with as $var pattern
      const nodes = [
        start(),
        func('func1', 'keys', { name: 'result', callType: 'builtin' }),
        arr('array1', 'arr'),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        // func1 has a name ('result') - creates variable with as $var pattern
        edge('e2', 'func1', 'array1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('e3', 'func1', 'array1', JQHandleIdPrefix.Bottom, `${JQHandleIdPrefix.Param}:0`),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Should create variable because the function node has a name
      expect(result).toContain('as $result');
      expect(result).toContain('$result');
    });

    it('should NOT create variables for Operator nodes', () => {
      const nodes = [
        start(),
        op('op1', '+', 'add'),
        num('val1', 5, 'num1'),
        num('val2', 3, 'num2'),
      ];
      const edges = [
        flow('e1', 'start', 'val1'),
        edge(
          'e2',
          'val1',
          'op1',
          `${JQHandleIdPrefix.OperatorRight}:val1`,
          JQHandleIdPrefix.OperatorLeft,
        ),
        edge(
          'e3',
          'val2',
          'op1',
          `${JQHandleIdPrefix.OperatorLeft}:val2`,
          JQHandleIdPrefix.OperatorRight,
        ),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Flow value with operator chain should create variable for the VALUE node,
      // but the OPERATOR node itself should never create a variable
      expect(result).not.toContain('as $add'); // Operator node doesn't create variable
      expect(result).toContain('as $num1'); // Flow value captures operator result
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      const nodes = [start(), str('value1', '', 'empty')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('"" as $empty | $empty');
    });

    it('should handle zero values', () => {
      const nodes = [start(), num('value1', 0, 'zero')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('0 as $zero | $zero');
    });

    it('should handle false boolean values', () => {
      const nodes = [start(), bool('value1', false, 'falseBool')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('false as $falseBool | $falseBool');
    });
  });

  describe('Parameter Sub-Flows', () => {
    it('should convert a parameter chain: map(.name | ascii_downcase)', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'myMap' }),
        path('paramVal', [seg.root('seg1'), seg.field('name', 'seg2')], 'nameField'),
        func('paramFunc', 'ascii_downcase', { name: 'downcase', callType: 'builtin' }),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        edge('e2', 'func1', 'paramVal', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'paramVal', 'paramFunc', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Value nodes in param chains create variables, each with as $var | $var
      expect(result).toBe(
        'map(.name as $nameField | ascii_downcase as $downcase | $downcase) as $myMap | $myMap',
      );
    });

    it('should convert a multi-step parameter chain with variable', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'myMap' }),
        path('paramVal', [seg.root('seg1'), seg.field('items', 'seg2')], 'itemsField'),
        func('paramFunc1', 'flatten', { name: 'myFlatten', callType: 'builtin' }),
        func('paramFunc2', 'length', { name: 'myLength', callType: 'builtin' }),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        edge('e2', 'func1', 'paramVal', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'paramVal', 'paramFunc1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('e4', 'paramFunc1', 'paramFunc2', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Every named node creates variable with as $var pattern
      expect(result).toBe(
        'map(.items as $itemsField | flatten as $myFlatten | length as $myLength | $myLength) as $myMap | $myMap',
      );
    });

    it('should support variable creation inside parameter chain', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'myMap' }),
        path('paramVal', [seg.root('seg1'), seg.field('items', 'seg2')], 'itemsField'),
        func('lenFunc', 'length', { name: 'len', callType: 'builtin' }),
        func('selectFunc', 'select', { name: 'mySelect', callType: 'builtin' }),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        edge('e2', 'func1', 'paramVal', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'paramVal', 'lenFunc', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('e4', 'lenFunc', 'selectFunc', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Every named node creates variable with as $var pattern
      expect(result).toBe(
        'map(.items as $itemsField | length as $len | select as $mySelect | $mySelect) as $myMap | $myMap',
      );
    });

    it('should bind a named root-connected Value node ahead of the call', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'myMap' }),
        path('rootVal', [seg.root('seg1'), seg.field('items', 'seg2')], 'rootInput'),
        path('paramVal', [seg.root('seg1'), seg.field('name', 'seg2')], 'nameField'),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        edge('e2', 'func1', 'rootVal', `${JQHandleIdPrefix.Root}:func1`, JQHandleIdPrefix.Top),
        edge('e3', 'func1', 'paramVal', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // The root chain is walked like every other side handle's chain, so the
      // named root value binds its name and pipes it into the call
      expect(result).toBe(
        '.items as $rootInput | $rootInput | map(.name as $nameField | $nameField) as $myMap | $myMap',
      );
    });

    it('should create variable for single Value node parameter', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'myMap' }),
        path('paramVal', [seg.root('seg1'), seg.field('name', 'seg2')], 'nameField'),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        edge('e2', 'func1', 'paramVal', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Single Value node in param creates variable; main func also creates variable
      expect(result).toBe('map(.name as $nameField | $nameField) as $myMap | $myMap');
    });
  });

  describe('FunctionCall Root/Input Handle', () => {
    it('should generate a root prefix ahead of the call', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'myMap' }),
        path('rootVal', [seg.root('seg1'), seg.field('items', 'seg2')], 'rootInput'),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        edge('e2', 'func1', 'rootVal', `${JQHandleIdPrefix.Root}:func1`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('.items as $rootInput | $rootInput | map as $myMap | $myMap');
    });

    it('should generate a root prefix ahead of a call with params', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'myMap' }),
        path('rootVal', [seg.root('seg1'), seg.field('items', 'seg2')], 'rootInput'),
        path('paramVal', [seg.root('seg1'), seg.field('name', 'seg2')], 'nameField'),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        edge('e2', 'func1', 'rootVal', `${JQHandleIdPrefix.Root}:func1`, JQHandleIdPrefix.Top),
        edge('e3', 'func1', 'paramVal', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe(
        '.items as $rootInput | $rootInput | map(.name as $nameField | $nameField) as $myMap | $myMap',
      );
    });

    it('should leave map unchanged when no root is connected', () => {
      const nodes = [start(), func('func1', 'map', { name: 'myMap' })];
      const edges = [flow('e1', 'start', 'func1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('map as $myMap | $myMap');
    });
  });
});
