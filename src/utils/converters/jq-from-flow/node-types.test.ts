/**
 * @fileoverview Tests for convertFlowToJQ: value, path, function-call, operator, conditional and complex-flow node types.
 */

import { describe, it, expect } from 'vitest';
import { convertFlowToJQ } from './index';
import { type JQEdge } from '../../../types';
import { ValueType, JQHandleIdPrefix } from '../../../enums';
import { createValueNode, createFunctionCallNode } from '../test-helpers';
import { start, str, num, bool, nil, path, func, op, cond, seg, flow, edge } from './flow-fixtures';

describe('convertFlowToJQ', () => {
  describe('Basic Node Types', () => {
    it('should convert a simple Start node to identity expression', () => {
      const nodes = [start()];
      const edges: JQEdge[] = [];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('.');
    });

    it('should convert Start node with Value node', () => {
      const nodes = [start(), str('value1', 'hello', 'myValue')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('"hello" as $myValue | $myValue');
    });
  });

  describe('Value Types', () => {
    it('should convert string values', () => {
      const nodes = [start(), str('value1', 'test string', 'str')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('"test string" as $str | $str');
    });

    it('should convert number values', () => {
      const nodes = [start(), num('value1', 42, 'num')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('42 as $num | $num');
    });

    it('should convert boolean values', () => {
      const nodes = [start(), bool('value1', true, 'bool')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('true as $bool | $bool');
    });

    it('should convert null values', () => {
      const nodes = [start(), nil('value1', 'nullVal')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('null as $nullVal | $nullVal');
    });

    it('should convert path values', () => {
      const nodes = [start(), path('value1', [seg.root('1'), seg.field('field1', '2')], 'path')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('.field1 as $path | $path');
    });

    it('should handle string escaping', () => {
      const nodes = [start(), str('value1', 'hello "world"\nnewline', 'str')];
      const edges = [flow('e1', 'start', 'value1')];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('\\"');
      expect(result).toContain('\\n');
    });
  });

  describe('Function Calls', () => {
    it('should convert basic function calls', () => {
      const nodes = [start(), func('func1', 'map', { name: 'myMap' })];
      const edges = [flow('e1', 'start', 'func1')];

      const result = convertFlowToJQ(nodes, edges);
      // Named functions create variables with as $var pattern
      expect(result).toContain('map');
      expect(result).toBe('map as $myMap | $myMap');
    });
  });

  describe('Operators', () => {
    it('should convert arithmetic operators', () => {
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
      expect(result).toContain('5');
      expect(result).toContain('3');
      expect(result).toContain('+');
    });
  });

  describe('Conditional Nodes', () => {
    it('should convert if-then-else conditionals', () => {
      const nodes = [
        start(),
        cond('cond1', [{ id: 'branch1' }], 'condition'),
        bool('ifVal', true, 'condition'),
        str('thenVal', 'yes', 'thenResult'),
        str('elseVal', 'no', 'elseResult'),
      ];
      const edges = [
        flow('e1', 'start', 'cond1'),
        edge('e2', 'cond1', 'ifVal', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'cond1', 'thenVal', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
        edge('e4', 'cond1', 'elseVal', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('if');
      expect(result).toContain('then');
      expect(result).toContain('else');
      expect(result).toContain('"yes"');
      expect(result).toContain('"no"');
    });

    it('should support sub-flow chain in then branch', () => {
      // Condition with a chain of nodes in the then branch:
      // then: path(.items) → func(map)
      const nodes = [
        start(),
        cond('cond1', [{ id: 'branch1' }], 'condition'),
        bool('ifVal', true, 'condition'),
        path('thenVal', [seg.root('s1'), seg.field('items', 's2')]),
        func('thenFunc', 'map', { name: 'thenMap' }),
        str('elseVal', 'default', 'elseResult'),
      ];
      const edges = [
        flow('e1', 'start', 'cond1'),
        edge('e2', 'cond1', 'ifVal', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'cond1', 'thenVal', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
        edge('e4', 'thenVal', 'thenFunc', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('e5', 'cond1', 'elseVal', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Then branch should have piped chain: .items | map
      expect(result).toContain('.items');
      expect(result).toContain('map');
      // The unnamed path node passes through, the named func creates variable
      expect(result).toContain('map as $thenMap');
    });

    it('should support sub-flow chain in else branch', () => {
      const nodes = [
        start(),
        cond('cond1', [{ id: 'branch1' }], 'condition'),
        bool('ifVal', true, 'condition'),
        str('thenVal', 'yes', 'thenResult'),
        path('elseVal', [seg.root('s1'), seg.field('fallback', 's2')]),
        func('elseFunc', 'keys', { name: 'elseKeys', callType: 'builtin' }),
      ];
      const edges = [
        flow('e1', 'start', 'cond1'),
        edge('e2', 'cond1', 'ifVal', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'cond1', 'thenVal', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
        edge('e4', 'cond1', 'elseVal', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
        edge('e5', 'elseVal', 'elseFunc', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Else branch should have piped chain: .fallback | keys
      expect(result).toContain('.fallback');
      expect(result).toContain('keys as $elseKeys');
    });

    it('should support named chain nodes with variables in condition branches', () => {
      const nodes = [
        start(),
        cond('cond1', [{ id: 'branch1' }], 'condition'),
        bool('ifVal', true, 'condition'),
        path('thenPath', [seg.root('s1'), seg.field('items', 's2')], 'items'),
        func('thenFunc', 'sort', { name: 'sorted', callType: 'builtin' }),
        str('elseVal', 'none', 'elseResult'),
      ];
      const edges = [
        flow('e1', 'start', 'cond1'),
        edge('e2', 'cond1', 'ifVal', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'cond1', 'thenPath', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
        edge('e4', 'thenPath', 'thenFunc', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('e5', 'cond1', 'elseVal', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Named nodes in then branch should create variables
      expect(result).toContain('.items as $items | sort as $sorted');
    });

    it('should support chain in if condition branch', () => {
      // Chain in the condition itself: path(.active) → func(not)
      // Use createValueNode/createFunctionCallNode directly with name: '' for unnamed nodes
      const nodes = [
        start(),
        cond('cond1', [{ id: 'branch1' }], 'condition'),
        createValueNode('ifPath', ValueType.Path, undefined, {
          name: '',
          pathSegments: [seg.root('s1'), seg.field('active', 's2')],
        }),
        createFunctionCallNode('ifFunc', 'not', { name: '', callType: 'builtin' }),
        str('thenVal', 'inactive', 'thenResult'),
        str('elseVal', 'active', 'elseResult'),
      ];
      const edges = [
        flow('e1', 'start', 'cond1'),
        edge('e2', 'cond1', 'ifPath', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('e3', 'ifPath', 'ifFunc', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('e4', 'cond1', 'thenVal', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
        edge('e5', 'cond1', 'elseVal', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // If condition should have piped chain: .active | not
      expect(result).toContain('if .active | not then');
    });
  });

  describe('Complex Flows', () => {
    it('should convert chained operations', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'mapped' }),
        func('func2', 'select', { name: 'selected' }),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        edge('e2', 'func1', 'func2', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Named nodes in chain create variables with as $var pattern
      expect(result).toContain('map');
      expect(result).toContain('select');
      expect(result).toBe('map as $mapped\n| select as $selected | $selected');
    });

    it('should handle multiple branches', () => {
      const nodes = [
        start(),
        func('func1', 'map', { name: 'mapped' }),
        path('param1', [seg.root('1'), seg.field('name', '2')], 'pathValue'),
      ];
      const edges = [
        flow('e1', 'start', 'func1'),
        // FIX: Parameters are OUTGOING from function, not incoming
        edge('e2', 'func1', 'param1', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('map');
      expect(result).toContain('.name');
    });
  });
});
