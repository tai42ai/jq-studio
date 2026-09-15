// @vitest-environment node
/**
 * @fileoverview Comment nodes inside object-field and array-item chains, and chains of comment nodes only.
 */

import { describe, expect, it } from 'vitest';

import { JQHandleIdPrefix, ValueType } from '../../../enums';
import {
  createChainEdge,
  createCommentNode,
  createConditionNode,
  createEdge,
  createFlowEdge,
  createFunctionCallNode,
  createFunctionDeclNode,
  createStartNode,
  createStringNode,
  createTryCatchNode,
  createValueNode,
  execJq,
} from '../test-helpers';
import { fieldA } from './comment-fixtures';
import { convertFlowToJQ } from './index';

describe('Comment nodes in object field and array item chains', () => {
  it('should parenthesise an array item whose chain pipes across a comment', async () => {
    const nodes = [
      createStartNode(),
      createValueNode('arr', ValueType.Array, undefined, {
        name: '',
        items: [{ id: 'it0' }, { id: 'it1' }],
      }),
      fieldA('i0'),
      createCommentNode('c1', 'note'),
      createFunctionCallNode('i0f', 'length', { name: '' }),
      createStringNode('i1', 'tail', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'arr'),
      createEdge('e2', 'arr', 'i0', `${JQHandleIdPrefix.Item}:it0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'i0', 'c1'),
      createChainEdge('e4', 'c1', 'i0f'),
      createEdge('e5', 'arr', 'i1', `${JQHandleIdPrefix.Item}:it1`, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // The comment carries `| length` to the head of the next line, and `|` binds
    // looser than `,` — unparenthesised, the item would swallow `"tail"`.
    expect(result).toBe('[\n  (.a # note\n| length),\n  "tail"\n]');
    await expect(execJq(result, { a: 'hello' })).resolves.toEqual([5, 'tail']);
  });

  it('should close the comment line before the item separator', async () => {
    const nodes = [
      createStartNode(),
      createValueNode('arr', ValueType.Array, undefined, {
        name: '',
        items: [{ id: 'it0' }, { id: 'it1' }],
      }),
      fieldA('i0'),
      createCommentNode('c1', 'note'),
      createStringNode('i1', 'tail', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'arr'),
      createEdge('e2', 'arr', 'i0', `${JQHandleIdPrefix.Item}:it0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'i0', 'c1'),
      createEdge('e4', 'arr', 'i1', `${JQHandleIdPrefix.Item}:it1`, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // A chain that ends on a comment is a term followed by that comment, so it
    // takes no parentheses. The newline the join appends puts the `,` on the next
    // line, out of the comment's reach.
    expect(result).toBe('[\n  .a # note\n,\n  "tail"\n]');
    await expect(execJq(result, { a: 'hello' })).resolves.toEqual(['hello', 'tail']);
  });

  it('should parenthesise an object field whose chain opens with a comment before an if', async () => {
    const nodes = [
      createStartNode(),
      createValueNode('obj', ValueType.Object, undefined, {
        name: '',
        fields: [{ id: 'f0', name: 'a' }],
      }),
      createCommentNode('c1', 'note'),
      createConditionNode('cond', [{ id: 'b0' }], { name: '' }),
      createValueNode('ifn', ValueType.Boolean, true, { name: '' }),
      createStringNode('thn', 'yes', { name: '' }),
      createStringNode('els', 'no', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'obj'),
      createEdge('e2', 'obj', 'c1', `${JQHandleIdPrefix.Field}:f0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'c1', 'cond'),
      createEdge('e4', 'cond', 'ifn', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
      createEdge('e5', 'cond', 'thn', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
      createEdge('e6', 'cond', 'els', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // The comment lines sit ahead of the `if`, so the keyword is not at the start
    // of the field's expression — unparenthesised, jq rejects the bare `if`.
    expect(result).toBe(
      '{\n  "a": (# note\n  if true then\n    "yes"\n  else\n    "no"\n  end)\n}',
    );
    await expect(execJq(result, {})).resolves.toEqual({ a: 'yes' });
  });

  it('should parenthesise an array item whose chain opens with a comment before an if', async () => {
    const nodes = [
      createStartNode(),
      createValueNode('arr', ValueType.Array, undefined, {
        name: '',
        items: [{ id: 'it0' }, { id: 'it1' }],
      }),
      createCommentNode('c1', 'note'),
      createConditionNode('cond', [{ id: 'b0' }], { name: '' }),
      createValueNode('ifn', ValueType.Boolean, true, { name: '' }),
      createStringNode('thn', 'yes', { name: '' }),
      createStringNode('els', 'no', { name: '' }),
      createStringNode('i1', 'tail', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'arr'),
      createEdge('e2', 'arr', 'c1', `${JQHandleIdPrefix.Item}:it0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'c1', 'cond'),
      createEdge('e4', 'cond', 'ifn', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
      createEdge('e5', 'cond', 'thn', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
      createEdge('e6', 'cond', 'els', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
      createEdge('e7', 'arr', 'i1', `${JQHandleIdPrefix.Item}:it1`, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe(
      '[\n  (# note\n  if true then\n    "yes"\n  else\n    "no"\n  end),\n  "tail"\n]',
    );
    await expect(execJq(result, {})).resolves.toEqual(['yes', 'tail']);
  });
});

describe('Chains of Comment nodes only', () => {
  it('should reject a main chain of comments only', () => {
    const nodes = [createStartNode(), createCommentNode('c1', 'note')];
    const edges = [createFlowEdge('e1', 'start', 'c1')];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject a main chain of Comment nodes with no text', () => {
    const nodes = [createStartNode(), createCommentNode('c1', '')];
    const edges = [createFlowEdge('e1', 'start', 'c1')];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject a parameter chain of comments only', () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'map', { name: '' }),
      createCommentNode('c1', 'note'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'c1', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject a function-declaration body of comments only', () => {
    const nodes = [
      createStartNode(),
      createFunctionDeclNode('fd1', [], { name: 'my_func' }),
      createCommentNode('c1', 'note'),
      createFunctionCallNode('main', 'my_func', { name: '', callType: 'custom' }),
    ];
    const edges = [
      createEdge('e1', 'start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
      createEdge('e2', 'fd1', 'c1', `${JQHandleIdPrefix.Logic}:fd1`, JQHandleIdPrefix.Top),
      createFlowEdge('e3', 'start', 'main'),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject a function-call root chain of comments only', () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'length', { name: '' }),
      createCommentNode('c1', 'note'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'c1', `${JQHandleIdPrefix.Root}:f1`, JQHandleIdPrefix.Top),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject a condition branch chain of comments only', () => {
    const nodes = [
      createStartNode(),
      createConditionNode('cond', [{ id: 'b0' }], { name: '' }),
      fieldA('ifn'),
      createCommentNode('c1', 'note'),
      createStringNode('els', 'fallback', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'cond'),
      createEdge('e2', 'cond', 'ifn', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
      createEdge('e3', 'cond', 'c1', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
      createEdge('e4', 'cond', 'els', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject a try branch chain of comments only', () => {
    const nodes = [
      createStartNode(),
      createTryCatchNode('tc', { name: '' }),
      createCommentNode('c1', 'note'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'tc'),
      createEdge('e2', 'tc', 'c1', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject a catch branch chain of comments only', () => {
    const nodes = [
      createStartNode(),
      createTryCatchNode('tc', { name: '' }),
      fieldA('tryVal'),
      createCommentNode('c1', 'note'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'tc'),
      createEdge('e2', 'tc', 'tryVal', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
      createEdge('e3', 'tc', 'c1', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject an array item chain of comments only', () => {
    const nodes = [
      createStartNode(),
      createValueNode('arr', ValueType.Array, undefined, {
        name: '',
        items: [{ id: 'it0' }],
      }),
      createCommentNode('c1', 'note'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'arr'),
      createEdge('e2', 'arr', 'c1', `${JQHandleIdPrefix.Item}:it0`, JQHandleIdPrefix.Top),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });

  it('should reject an object field chain of comments only', () => {
    const nodes = [
      createStartNode(),
      createValueNode('obj', ValueType.Object, undefined, {
        name: '',
        fields: [{ id: 'f0', name: 'a' }],
      }),
      createCommentNode('c1', 'note'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'obj'),
      createEdge('e2', 'obj', 'c1', `${JQHandleIdPrefix.Field}:f0`, JQHandleIdPrefix.Top),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });
});
