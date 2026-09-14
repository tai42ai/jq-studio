// @vitest-environment node
/**
 * @fileoverview Comment nodes inside inline-joined chains, condition/try-catch branches, function-call roots and operator operands.
 */

import { describe, it, expect } from 'vitest';
import { convertFlowToJQ } from './index';
import { JQHandleIdPrefix } from '../../../enums';
import {
  createStartNode,
  createStringNode,
  createNumberNode,
  createPathNode,
  createConditionNode,
  createFunctionCallNode,
  createFunctionDeclNode,
  createOperatorNode,
  createTryCatchNode,
  createCommentNode,
  createChainEdge,
  createEdge,
  createFlowEdge,
  createPathSegment,
  execJq,
} from '../test-helpers';
import { fieldA } from './comment-fixtures';

describe('Comment nodes in inline-joined chains', () => {
  it('should end the comment line before the rest of a parameter chain', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'map', { name: '' }),
      fieldA('pv'),
      createCommentNode('c1', 'note'),
      createFunctionCallNode('pf', 'length', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'pv', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'pv', 'c1'),
      createChainEdge('e4', 'c1', 'pf'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('map(.a # note\n| length)');
    await expect(execJq(result, [{ a: 'hello' }])).resolves.toEqual([5]);
  });

  it('should end the comment line before the rest of a function-declaration body', async () => {
    const nodes = [
      createStartNode(),
      createFunctionDeclNode('fd1', [], { name: 'my_func' }),
      fieldA('b1'),
      createCommentNode('c1', 'note'),
      createFunctionCallNode('b2', 'length', { name: '' }),
      createFunctionCallNode('main', 'my_func', { name: '', callType: 'custom' }),
    ];
    const edges = [
      createEdge('e1', 'start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
      createEdge('e2', 'fd1', 'b1', `${JQHandleIdPrefix.Logic}:fd1`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'b1', 'c1'),
      createChainEdge('e4', 'c1', 'b2'),
      createFlowEdge('e5', 'start', 'main'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('def my_func:\n  .a # note\n| length;\n\nmy_func');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(5);
  });

  it('should keep a comment-free parameter chain on one line', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'map', { name: '' }),
      fieldA('pv'),
      createFunctionCallNode('pf', 'length', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'pv', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'pv', 'pf'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('map(.a | length)');
    await expect(execJq(result, [{ a: 'hello' }])).resolves.toEqual([5]);
  });
});

describe('Comment nodes ending an inline-joined chain', () => {
  it('should close the comment line before the parameter list closes', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'map', { name: '' }),
      fieldA('pv'),
      createCommentNode('c1', 'note'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'pv', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'pv', 'c1'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('map(.a # note\n)');
    await expect(execJq(result, [{ a: 'hello' }])).resolves.toEqual(['hello']);
  });

  it('should close the comment line before the next parameter separator', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'sub', { name: '' }),
      createStringNode('p0', 'a', { name: '' }),
      createCommentNode('c1', 'note'),
      createStringNode('p1', 'b', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'p0', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'p0', 'c1'),
      createEdge('e4', 'f1', 'p1', `${JQHandleIdPrefix.Param}:1`, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('sub("a" # note\n; "b")');
    await expect(execJq(result, 'abc')).resolves.toBe('bbc');
  });

  it('should close the comment line before the declaration terminator', async () => {
    const nodes = [
      createStartNode(),
      createFunctionDeclNode('fd1', [], { name: 'my_func' }),
      fieldA('b1'),
      createCommentNode('c1', 'note'),
      createFunctionCallNode('main', 'my_func', { name: '', callType: 'custom' }),
    ];
    const edges = [
      createEdge('e1', 'start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
      createEdge('e2', 'fd1', 'b1', `${JQHandleIdPrefix.Logic}:fd1`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'b1', 'c1'),
      createFlowEdge('e4', 'start', 'main'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('def my_func:\n  .a # note\n;\n\nmy_func');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe('hello');
  });
});

describe('Comment nodes in condition branch chains', () => {
  it('should emit a comment line inside a then-branch chain', async () => {
    const nodes = [
      createStartNode(),
      createConditionNode('cond', [{ id: 'b0' }], { name: '' }),
      createPathNode(
        'ifn',
        [createPathSegment('ifn_s1', 'root', ''), createPathSegment('ifn_s2', 'field', 'c')],
        { name: '' },
      ),
      fieldA('thn'),
      createCommentNode('c1', 'note'),
      createStringNode('els', 'fallback', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'cond'),
      createEdge('e2', 'cond', 'ifn', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
      createEdge('e3', 'cond', 'thn', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
      createChainEdge('e4', 'thn', 'c1'),
      createEdge('e5', 'cond', 'els', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('if .c then\n  .a # note\n\nelse\n  "fallback"\nend');
    await expect(execJq(result, { c: true, a: 'yes' })).resolves.toBe('yes');
    await expect(execJq(result, { c: false, a: 'yes' })).resolves.toBe('fallback');
  });

  it('should end the comment line before the rest of a then-branch chain', async () => {
    const nodes = [
      createStartNode(),
      createConditionNode('cond', [{ id: 'b0' }], { name: '' }),
      createPathNode(
        'ifn',
        [createPathSegment('ifn_s1', 'root', ''), createPathSegment('ifn_s2', 'field', 'c')],
        { name: '' },
      ),
      fieldA('thn'),
      createCommentNode('c1', 'note'),
      createFunctionCallNode('thf', 'length', { name: '' }),
      createStringNode('els', 'fallback', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'cond'),
      createEdge('e2', 'cond', 'ifn', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
      createEdge('e3', 'cond', 'thn', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
      createChainEdge('e4', 'thn', 'c1'),
      createChainEdge('e5', 'c1', 'thf'),
      createEdge('e6', 'cond', 'els', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('if .c then\n  .a # note\n| length\nelse\n  "fallback"\nend');
    await expect(execJq(result, { c: true, a: 'hello' })).resolves.toBe(5);
  });
});

describe('Comment nodes in try/catch branch chains', () => {
  it('should keep the catch guarding a try body whose chain carries a comment', async () => {
    const nodes = [
      createStartNode(),
      createTryCatchNode('tc', { name: '' }),
      fieldA('t1'),
      createCommentNode('c1', 'note'),
      createFunctionCallNode('t2', 'length', { name: '' }),
      createStringNode('cv', 'oops', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'tc'),
      createEdge('e2', 'tc', 't1', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
      createChainEdge('e3', 't1', 'c1'),
      createChainEdge('e4', 'c1', 't2'),
      createEdge('e5', 'tc', 'cv', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // The comment forces `| length` onto its own line, so the try body's pipe is
    // a line-leading `| ` rather than an inline ` | `. Parenthesising on the
    // inline separator alone would leave `length` outside the try and produce
    // `try .a # note\n| length catch "oops"`, which jq rejects outright.
    expect(result).toBe('try (.a # note\n| length) catch "oops"');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(5);
    // `length` of a boolean is a jq error — the catch has to see it.
    await expect(execJq(result, { a: true })).resolves.toBe('oops');
  });

  it('should keep a catch chain that carries a comment inside the catch', async () => {
    const nodes = [
      createStartNode(),
      createTryCatchNode('tc', { name: '' }),
      fieldA('t1'),
      createFunctionCallNode('t2', 'length', { name: '' }),
      createStringNode('c1', 'oops', { name: '' }),
      createCommentNode('cm', 'note'),
      createFunctionCallNode('c2', 'ascii_upcase', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'tc'),
      createEdge('e2', 'tc', 't1', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
      createChainEdge('e3', 't1', 't2'),
      createEdge('e4', 'tc', 'c1', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
      createChainEdge('e5', 'c1', 'cm'),
      createChainEdge('e6', 'cm', 'c2'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // `catch` binds tighter than `|` just as `try` does, so an unparenthesised
    // catch chain would leave `| ascii_upcase` reading the whole try/catch
    // result — including the value the try body produced when it succeeded. The
    // comment moves that pipe to the head of the next line, so the wrap has to
    // catch that separator too.
    expect(result).toBe('try (.a | length) catch ("oops" # note\n| ascii_upcase)');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(5);
    await expect(execJq(result, { a: true })).resolves.toBe('OOPS');
  });
});

describe('Comment nodes in a function-call root chain', () => {
  it('should end the comment line before the call the root input feeds', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'length', { name: '' }),
      fieldA('rv'),
      createCommentNode('c1', 'note'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'rv', `${JQHandleIdPrefix.Root}:f1`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'rv', 'c1'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('.a # note\n | length');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(5);
  });
});

describe('Comment nodes in operator operand chains', () => {
  it('should end the comment line before the rest of an operand chain', async () => {
    const nodes = [
      createStartNode(),
      fieldA('lhs'),
      createCommentNode('c1', 'note'),
      createFunctionCallNode('len', 'length', { name: '' }),
      createOperatorNode('op', '>', { name: '' }),
      createNumberNode('rhs', 2, { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'lhs'),
      createChainEdge('e2', 'lhs', 'c1'),
      createChainEdge('e3', 'c1', 'len'),
      createEdge('e4', 'lhs', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      createEdge('e5', 'rhs', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('((.a # note\n| length) > 2)');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(true);
    await expect(execJq(result, { a: 'hi' })).resolves.toBe(false);
  });

  it('should close the comment line before the operator that follows an operand', async () => {
    const nodes = [
      createStartNode(),
      fieldA('lhs'),
      createCommentNode('c1', 'note'),
      createOperatorNode('op', '==', { name: '' }),
      createStringNode('rhs', 'hello', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'lhs'),
      createChainEdge('e2', 'lhs', 'c1'),
      createEdge('e3', 'lhs', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      createEdge('e4', 'rhs', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // The operand is a term followed by a comment, so it needs no parentheses of
    // its own — the newline the join appends carries the operator to the next
    // line, where the comment can no longer swallow it.
    expect(result).toBe('(.a # note\n == "hello")');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(true);
    await expect(execJq(result, { a: 'bye' })).resolves.toBe(false);
  });

  it('should reject an operand chain of comments only', () => {
    const nodes = [
      createStartNode(),
      createCommentNode('c1', 'note'),
      createOperatorNode('op', '>', { name: '' }),
      createNumberNode('rhs', 2, { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'c1'),
      createEdge('e2', 'c1', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      createEdge('e3', 'rhs', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight),
    ];

    expect(() => convertFlowToJQ(nodes, edges)).toThrow(
      'Chain starting at node c1 cannot consist of comments only',
    );
  });
});
