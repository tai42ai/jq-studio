/**
 * @fileoverview Tests for convertFlowToJQ error handling.
 */

import { describe, it, expect } from 'vitest';
import { convertFlowToJQ } from './index';
import { type JQEdge } from '../../../types';
import { ValueType, JQHandleIdPrefix } from '../../../enums';
import { createValueNode } from '../test-helpers';
import { start, str, num, path, func, tryCatch, seg, flow, edge } from './flow-fixtures';

describe('convertFlowToJQ', () => {
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
  });
});
