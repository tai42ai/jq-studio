/**
 * @fileoverview Tests for convertFlowToJQ: function declarations, array/object children, try/catch and comment nodes.
 */

import { describe, expect, it } from 'vitest';

import { JQHandleIdPrefix, ValueType } from '../../../enums';
import {
  createChainEdge,
  createCommentNode,
  createFunctionDeclNode,
  createValueNode,
} from '../test-helpers';
import { edge, flow, func, path, seg, start, str, tryCatch } from './flow-fixtures';
import { convertFlowToJQ } from './index';

describe('convertFlowToJQ', () => {
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
