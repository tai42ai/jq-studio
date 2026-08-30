/**
 * @fileoverview Tests for JQ from Flow converter.
 */

import { describe, it, expect } from 'vitest';
import { convertFlowToJQ } from './index';
import { type JQEdge } from '../../../types';
import { ValueType, JQHandleIdPrefix } from '../../../enums';
import {
  createStartNode,
  createValueNode,
  createFunctionCallNode,
  createFunctionDeclNode,
  createOperatorNode,
  createConditionNode,
  createTryCatchNode,
  createCommentNode,
  createChainEdge,
  createEdge,
  createFlowEdge,
  createPathSegment,
} from '../test-helpers';

// ---------------------------------------------------------------------------
// Convenience wrappers (keep tests concise)
// ---------------------------------------------------------------------------

const start = (id = 'start') => createStartNode(id);

const str = (id: string, value: string, name?: string) =>
  createValueNode(id, ValueType.String, value, { name: name ?? id });

const num = (id: string, value: number, name?: string) =>
  createValueNode(id, ValueType.Number, value, { name: name ?? id });

const bool = (id: string, value: boolean, name?: string) =>
  createValueNode(id, ValueType.Boolean, value, { name: name ?? id });

const nil = (id: string, name?: string) =>
  createValueNode(id, ValueType.Null, null, { name: name ?? id });

const path = (id: string, segments: ReturnType<typeof createPathSegment>[], name?: string) =>
  createValueNode(id, ValueType.Path, undefined, { name: name ?? id, pathSegments: segments });

const arr = (id: string, name?: string) =>
  createValueNode(id, ValueType.Array, undefined, { name: name ?? id, items: [] });

const func = (id: string, selected: string, opts: { name?: string; callType?: string } = {}) =>
  createFunctionCallNode(id, selected, {
    name: opts.name ?? id,
    callType: opts.callType ?? 'builtin',
  });

const op = (id: string, operator: string, name?: string) =>
  createOperatorNode(id, operator, { name: name ?? id });

const cond = (id: string, branches: { id: string }[], name?: string) =>
  createConditionNode(id, branches, { name: name ?? id });

const tryCatch = (id: string, name?: string) => createTryCatchNode(id, { name: name ?? id });

/** Shorthand for common path segments */
const seg = {
  root: (id = 'seg0') => createPathSegment(id, 'root', '.'),
  field: (field: string, id = `seg_${field}`) => createPathSegment(id, 'field', field),
};

/** Flow edge (Start → next) */
const flow = (id: string, source: string, target: string) => createFlowEdge(id, source, target);

/** Custom edge */
const edge = (id: string, source: string, target: string, srcHandle: string, tgtHandle: string) =>
  createEdge(id, source, target, srcHandle, tgtHandle);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

  describe('Error Handling', () => {
    it('should throw error if no Start node exists', () => {
      const nodes = [str('value1', 'test', 'val')];
      const edges: JQEdge[] = [];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow();
    });

    it('should throw error if multiple Start nodes exist', () => {
      const nodes = [start('start1'), start('start2')];
      const edges: JQEdge[] = [];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow();
    });

    it('should throw error if an object field edge names an undeclared field', () => {
      // The field's key name lives only in the node's field list, so an edge naming a
      // field that is not listed there cannot be emitted — and must not be dropped.
      const nodes = [
        start(),
        createValueNode('obj1', ValueType.Object, undefined, {
          name: 'myObj',
          fields: [{ id: 'field_0', name: 'result' }],
        }),
        func('fc1', 'length', { name: '', callType: 'builtin' }),
      ];
      const edges = [
        flow('e1', 'start', 'obj1'),
        edge('e2', 'obj1', 'fc1', `${JQHandleIdPrefix.Field}:field_9`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Object node obj1 has no field field_9 for edge e2/,
      );
    });

    it('should emit declared object fields in declared order, not edge order', () => {
      // The companion of the case above: every field edge names a declared field, and
      // the keys come out in the order the node lists them however the edges are
      // ordered — the order the flow draws is the one the object reads in.
      const nodes = [
        start(),
        createValueNode('obj1', ValueType.Object, undefined, {
          name: 'myObj',
          fields: [
            { id: 'field_0', name: 'a' },
            { id: 'field_1', name: 'b' },
            { id: 'field_2', name: 'c' },
          ],
        }),
        num('n1', 1, ''),
        num('n2', 2, ''),
        num('n3', 3, ''),
      ];
      const edges = [
        flow('e1', 'start', 'obj1'),
        edge('e2', 'obj1', 'n3', `${JQHandleIdPrefix.Field}:field_2`, JQHandleIdPrefix.Top),
        edge('e3', 'obj1', 'n1', `${JQHandleIdPrefix.Field}:field_0`, JQHandleIdPrefix.Top),
        edge('e4', 'obj1', 'n2', `${JQHandleIdPrefix.Field}:field_1`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('{"a": 1, "b": 2, "c": 3} as $myObj | $myObj');
    });

    it('should convert every declared object field without raising', () => {
      // The companion of the case above: every field edge names a declared field, so
      // the conversion emits both keys.
      const nodes = [
        start(),
        createValueNode('obj1', ValueType.Object, undefined, {
          name: 'myObj',
          fields: [
            { id: 'field_0', name: 'result' },
            { id: 'field_1', name: 'count' },
          ],
        }),
        func('fc1', 'length', { name: '', callType: 'builtin' }),
        num('n1', 7, ''),
      ];
      const edges = [
        flow('e1', 'start', 'obj1'),
        edge('e2', 'obj1', 'fc1', `${JQHandleIdPrefix.Field}:field_0`, JQHandleIdPrefix.Top),
        edge('e3', 'obj1', 'n1', `${JQHandleIdPrefix.Field}:field_1`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('{"result": length, "count": 7} as $myObj | $myObj');
    });

    it('should throw error if a parameter edge leaves a handle with no argument position', () => {
      // A call's arguments are ordered by the index in the `param---:<index>` handle
      // alone. A handle without one was read as position 0, leaving the order to
      // however the edges happen to be stored: the conversion answered `range(9; 5)`
      // for a flow that draws `range(5; 9)` — a call jq compiles and runs backwards.
      const nodes = [
        start(),
        func('f1', 'range', { name: '' }),
        num('n9', 9, ''),
        num('n5', 5, ''),
      ];
      const edges = [
        flow('e1', 'start', 'f1'),
        edge('e2', 'f1', 'n9', JQHandleIdPrefix.Param, JQHandleIdPrefix.Top),
        edge('e3', 'f1', 'n5', JQHandleIdPrefix.Param, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /FunctionCall node f1 parameter edge e2 leaves handle "param---", which carries no argument position/,
      );
    });

    it('should throw error if a parameter handle carries a non-numeric argument position', () => {
      // The same hole read the other way: a handle whose suffix is not a whole number
      // sorted as NaN, which compares equal to everything and leaves the stored order
      // untouched — `range(9; 5)` again for a flow that draws `range(5; 9)`.
      const nodes = [
        start(),
        func('f1', 'range', { name: '' }),
        num('n9', 9, ''),
        num('n5', 5, ''),
      ];
      const edges = [
        flow('e1', 'start', 'f1'),
        edge('e2', 'f1', 'n9', `${JQHandleIdPrefix.Param}:x`, JQHandleIdPrefix.Top),
        edge('e3', 'f1', 'n5', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /FunctionCall node f1 parameter edge e2 leaves handle "param---:x", which carries no argument position/,
      );
    });

    it('should throw error if a lone parameter handle carries no argument position', () => {
      // A single-parameter call compares nothing, so the position is read off every
      // parameter edge before any sorting rather than inside the comparison.
      const nodes = [start(), func('f1', 'map', { name: '' }), num('n1', 1, '')];
      const edges = [
        flow('e1', 'start', 'f1'),
        edge('e2', 'f1', 'n1', JQHandleIdPrefix.Param, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /FunctionCall node f1 parameter edge e2 leaves handle "param---", which carries no argument position/,
      );
    });

    it('should throw error if an array item edge names an undeclared item', () => {
      // An item's position lives only in the node's item list, so an edge naming an item
      // that is not listed there has no index to sort by. It sorted ahead of every
      // declared item and the conversion answered `[2, 1, 3]`.
      const nodes = [
        start(),
        createValueNode('arr1', ValueType.Array, undefined, {
          name: 'myArr',
          items: [{ id: 'item_0' }, { id: 'item_1' }],
        }),
        num('n1', 1, ''),
        num('n2', 2, ''),
        num('n3', 3, ''),
      ];
      const edges = [
        flow('e1', 'start', 'arr1'),
        edge('e2', 'arr1', 'n1', `${JQHandleIdPrefix.Item}:item_0`, JQHandleIdPrefix.Top),
        edge('e3', 'arr1', 'n2', `${JQHandleIdPrefix.Item}:item_9`, JQHandleIdPrefix.Top),
        edge('e4', 'arr1', 'n3', `${JQHandleIdPrefix.Item}:item_1`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /Array node arr1 has no item item_9 for edge e3/,
      );
    });

    it('should emit declared array items in declared order, not edge order', () => {
      // The companion of the case above: every item edge names a declared item, and the
      // items come out in the order the node lists them however the edges are ordered.
      const nodes = [
        start(),
        createValueNode('arr1', ValueType.Array, undefined, {
          name: 'myArr',
          items: [{ id: 'item_0' }, { id: 'item_1' }, { id: 'item_2' }],
        }),
        num('n1', 1, ''),
        num('n2', 2, ''),
        num('n3', 3, ''),
      ];
      const edges = [
        flow('e1', 'start', 'arr1'),
        edge('e2', 'arr1', 'n3', `${JQHandleIdPrefix.Item}:item_2`, JQHandleIdPrefix.Top),
        edge('e3', 'arr1', 'n1', `${JQHandleIdPrefix.Item}:item_0`, JQHandleIdPrefix.Top),
        edge('e4', 'arr1', 'n2', `${JQHandleIdPrefix.Item}:item_1`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('[1, 2, 3] as $myArr | $myArr');
    });

    it('should throw error if the Start flow edge targets a missing node', () => {
      // A Start node with no flow edge is the identity program, but a flow edge pointing
      // at a node the graph does not contain is a program that was lost — answering `.`
      // would hand back a passthrough the flow never drew.
      const nodes = [start()];
      const edges = [flow('e1', 'start', 'ghost')];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e1: source start, target ghost — target not in graph/,
      );
    });

    it('should throw error if an array item edge targets a missing node', () => {
      // Dropping the item would shift every later index down, so the array the caller
      // gets back would not be the array the flow draws.
      const nodes = [
        start(),
        createValueNode('arr1', ValueType.Array, undefined, {
          name: 'myArr',
          items: [{ id: 'item_0' }, { id: 'item_1' }],
        }),
        num('n1', 1, ''),
      ];
      const edges = [
        flow('e1', 'start', 'arr1'),
        edge('e2', 'arr1', 'n1', `${JQHandleIdPrefix.Item}:item_0`, JQHandleIdPrefix.Top),
        edge('e3', 'arr1', 'ghost', `${JQHandleIdPrefix.Item}:item_1`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source arr1, target ghost — target not in graph/,
      );
    });

    it('should throw error if an object field edge targets a missing node', () => {
      // The field is declared and connected, so dropping the edge would emit an object
      // silently missing a key.
      const nodes = [
        start(),
        createValueNode('obj1', ValueType.Object, undefined, {
          name: 'myObj',
          fields: [{ id: 'field_0', name: 'result' }],
        }),
      ];
      const edges = [
        flow('e1', 'start', 'obj1'),
        edge('e2', 'obj1', 'ghost', `${JQHandleIdPrefix.Field}:field_0`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source obj1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a FunctionCall param edge targets a missing node', () => {
      // Skipping the param would emit `map` where `map(...)` was drawn — a different
      // call, or one jq rejects outright.
      const nodes = [start(), func('fc1', 'map', { name: 'myMap' })];
      const edges = [
        flow('e1', 'start', 'fc1'),
        edge('e2', 'fc1', 'ghost', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source fc1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a FunctionCall root edge targets a missing node', () => {
      // The root handle supplies the call's input, so dropping the edge would run the
      // call against whatever the surrounding chain happens to pipe in.
      const nodes = [start(), func('fc1', 'map', { name: 'myMap' })];
      const edges = [
        flow('e1', 'start', 'fc1'),
        edge('e2', 'fc1', 'ghost', `${JQHandleIdPrefix.Root}:fc1`, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e2: source fc1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a TryCatch catch edge targets a missing node', () => {
      // The catch handle is optional, but an edge leaving it is not: a bare `try` would
      // swallow the error the flow draws a handler for.
      const nodes = [
        start(),
        tryCatch('tc1', 'tc'),
        path('tryVal', [seg.root('s1'), seg.field('x', 's2')]),
      ];
      const edges = [
        flow('e1', 'start', 'tc1'),
        edge('e2', 'tc1', 'tryVal', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
        edge('e3', 'tc1', 'ghost', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e3: source tc1, target ghost — target not in graph/,
      );
    });

    it('should throw error if a functions edge targets a missing node', () => {
      // Skipping the edge would drop a `def` that every call site still names.
      const nodes = [start()];
      const edges = [
        edge('e1', 'start', 'ghost', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
      ];

      expect(() => convertFlowToJQ(nodes, edges)).toThrow(
        /edge e1: source start, target ghost — target not in graph/,
      );
    });

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

  describe('Function Declarations', () => {
    it('should generate a simple parameterless function declaration', () => {
      const nodes = [
        start(),
        createFunctionDeclNode('fd1', [], { name: 'my_func' }),
        path('body1', [seg.root('s1'), seg.field('value', 's2')], 'body_val'),
      ];
      const edges = [
        edge('e1', 'start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
        edge('e2', 'fd1', 'body1', JQHandleIdPrefix.Logic, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('def my_func');
      expect(result).toContain('.value');
      // Main expression should still be identity
      expect(result).toMatch(/\n\n\.$/);
    });

    it('should generate a function declaration with parameters', () => {
      const nodes = [
        start(),
        createFunctionDeclNode('fd1', ['f', 'g'], { name: 'my_func' }),
        path('body1', [seg.root('s1'), seg.field('result', 's2')], 'body_val'),
      ];
      const edges = [
        edge('e1', 'start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
        edge('e2', 'fd1', 'body1', JQHandleIdPrefix.Logic, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('def my_func(f; g)');
    });

    it('should generate function declaration with identity body when no logic connected', () => {
      const nodes = [start(), createFunctionDeclNode('fd1', [], { name: 'passthrough' })];
      const edges = [edge('e1', 'start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top)];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('def passthrough');
      expect(result).toContain(': .;');
    });

    it('should combine function declarations with main flow', () => {
      const nodes = [
        start(),
        createFunctionDeclNode('fd1', ['f'], { name: 'double' }),
        path('body1', [seg.root('s1'), seg.field('x', 's2')], 'body_val'),
        func('fc1', 'map', { name: 'mapped' }),
      ];
      const edges = [
        // Function declaration
        edge('e1', 'start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
        edge('e2', 'fd1', 'body1', JQHandleIdPrefix.Logic, JQHandleIdPrefix.Top),
        // Main flow
        flow('e3', 'start', 'fc1'),
      ];

      const result = convertFlowToJQ(nodes, edges);
      // Should have function declaration followed by main expression
      expect(result).toContain('def double(f)');
      expect(result).toContain('map');
      // Function decl should come before main expression
      const defIndex = result.indexOf('def');
      const mapIndex = result.indexOf('map');
      expect(defIndex).toBeLessThan(mapIndex);
    });
  });

  describe('FunctionCall as Array/Object Child', () => {
    it('should convert FunctionCall as array item', () => {
      const nodes = [
        start(),
        createValueNode('arr1', ValueType.Array, undefined, {
          name: 'myArr',
          items: [{ id: 'item_0' }],
        }),
        func('fc1', 'keys', { name: '', callType: 'builtin' }),
      ];
      const edges = [
        flow('e1', 'start', 'arr1'),
        edge('e2', 'arr1', 'fc1', `${JQHandleIdPrefix.Item}:item_0`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('[keys]');
    });

    it('should convert FunctionCall as object field value', () => {
      const nodes = [
        start(),
        createValueNode('obj1', ValueType.Object, undefined, {
          name: 'myObj',
          fields: [{ id: 'field_0', name: 'result' }],
        }),
        func('fc1', 'length', { name: '', callType: 'builtin' }),
      ];
      const edges = [
        flow('e1', 'start', 'obj1'),
        edge('e2', 'obj1', 'fc1', `${JQHandleIdPrefix.Field}:field_0`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('"result": length');
    });

    it('should convert FunctionCall with params as array item', () => {
      const nodes = [
        start(),
        createValueNode('arr1', ValueType.Array, undefined, {
          name: 'myArr',
          items: [{ id: 'item_0' }],
        }),
        func('fc1', 'map', { name: '', callType: 'builtin' }),
        createValueNode('p1', ValueType.Path, undefined, {
          name: '',
          pathSegments: [seg.root('s1'), seg.field('name', 's2')],
        }),
      ];
      const edges = [
        flow('e1', 'start', 'arr1'),
        edge('e2', 'arr1', 'fc1', `${JQHandleIdPrefix.Item}:item_0`, JQHandleIdPrefix.Top),
        edge('e3', 'fc1', 'p1', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('map(.name)');
    });
  });

  describe('TryCatch Nodes', () => {
    it('should convert try-catch with both handles connected', () => {
      const nodes = [
        start(),
        tryCatch('tc1', 'tc'),
        path('tryVal', [seg.root('s1'), seg.field('x', 's2')]),
        str('catchVal', 'default', 'fallback'),
      ];
      const edges = [
        flow('e1', 'start', 'tc1'),
        edge('e2', 'tc1', 'tryVal', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
        edge('e3', 'tc1', 'catchVal', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('try');
      expect(result).toContain('.x');
      expect(result).toContain('catch');
      expect(result).toContain('"default"');
    });

    it('should convert try-only (no catch handle)', () => {
      const nodes = [
        start(),
        tryCatch('tc1', 'tc'),
        path('tryVal', [seg.root('s1'), seg.field('x', 's2')]),
      ];
      const edges = [
        flow('e1', 'start', 'tc1'),
        edge('e2', 'tc1', 'tryVal', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('try (.x as $tryVal | $tryVal)');
      expect(result).not.toContain('catch');
    });

    it('should support sub-flow chain in try branch', () => {
      const nodes = [
        start(),
        tryCatch('tc1', 'tc'),
        path('tryVal', [seg.root('s1'), seg.field('items', 's2')]),
        func('tryFunc', 'map', { name: 'tryMap' }),
        str('catchVal', 'error', 'fallback'),
      ];
      const edges = [
        flow('e1', 'start', 'tc1'),
        edge('e2', 'tc1', 'tryVal', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
        edge('e3', 'tryVal', 'tryFunc', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('e4', 'tc1', 'catchVal', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('.items');
      expect(result).toContain('map as $tryMap');
      expect(result).toContain('catch');
    });

    it('should convert try-catch in main flow chain', () => {
      const nodes = [
        start(),
        path('p1', [seg.root('s1'), seg.field('data', 's2')], 'data'),
        tryCatch('tc1', 'tc'),
        path('tryVal', [seg.root('s1'), seg.field('x', 's2')], ''),
        str('catchVal', 'fallback', ''),
        func('f1', 'keys', { name: 'result' }),
      ];
      const edges = [
        flow('e1', 'start', 'p1'),
        edge('e2', 'p1', 'tc1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('e3', 'tc1', 'tryVal', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
        edge('e4', 'tc1', 'catchVal', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
        edge('e5', 'tc1', 'f1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
      ];

      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('.data');
      expect(result).toContain('try');
      expect(result).toContain('.x');
      expect(result).toContain('catch');
      expect(result).toContain('"fallback"');
      expect(result).toContain('keys');
    });
  });

  // -------------------------------------------------------------------------
  // Comment Nodes
  // -------------------------------------------------------------------------

  describe('Comment Nodes', () => {
    it('should emit comment line for Comment node in chain', () => {
      const nodes = [
        start(),
        createCommentNode('c1', 'transform step'),
        func('f1', 'map', { name: '' }),
      ];
      const edges = [flow('e1', 'start', 'c1'), createChainEdge('e2', 'c1', 'f1')];
      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('# transform step');
      expect(result).toContain('map');
    });

    it('should not emit comment for unconnected Comment node', () => {
      const nodes = [
        start(),
        func('f1', 'map', { name: '' }),
        createCommentNode('c1', 'floating note'),
      ];
      const edges = [
        flow('e1', 'start', 'f1'),
        // Comment node is not connected
      ];
      const result = convertFlowToJQ(nodes, edges);
      expect(result).not.toContain('#');
    });

    it('should emit comment between two pipeline stages', () => {
      const nodes = [
        start(),
        func('f1', 'map', { name: '' }),
        createCommentNode('c1', 'filter next'),
        func('f2', 'select', { name: '' }),
      ];
      const edges = [
        flow('e1', 'start', 'f1'),
        createChainEdge('e2', 'f1', 'c1'),
        createChainEdge('e3', 'c1', 'f2'),
      ];
      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('map\n# filter next\n| select');
    });

    it('should emit multiple comments in chain', () => {
      const nodes = [
        start(),
        createCommentNode('c1', 'first'),
        func('f1', 'map', { name: '' }),
        createCommentNode('c2', 'second'),
        func('f2', 'select', { name: '' }),
      ];
      const edges = [
        flow('e1', 'start', 'c1'),
        createChainEdge('e2', 'c1', 'f1'),
        createChainEdge('e3', 'f1', 'c2'),
        createChainEdge('e4', 'c2', 'f2'),
      ];
      const result = convertFlowToJQ(nodes, edges);
      expect(result).toBe('# first\nmap\n# second\n| select');
    });

    it('should not emit comment when Comment node text is empty', () => {
      const nodes = [start(), createCommentNode('c1', ''), func('f1', 'keys', { name: '' })];
      const edges = [flow('e1', 'start', 'c1'), createChainEdge('e2', 'c1', 'f1')];
      const result = convertFlowToJQ(nodes, edges);
      expect(result).not.toContain('#');
    });

    it('should emit multiline comment as multiple # lines', () => {
      const nodes = [
        start(),
        createCommentNode('c1', 'line1\nline2'),
        func('f1', 'keys', { name: '' }),
      ];
      const edges = [flow('e1', 'start', 'c1'), createChainEdge('e2', 'c1', 'f1')];
      const result = convertFlowToJQ(nodes, edges);
      expect(result).toContain('# line1');
      expect(result).toContain('# line2');
    });
  });
});
