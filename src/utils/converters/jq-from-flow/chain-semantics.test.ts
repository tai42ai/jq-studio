// @vitest-environment node
/**
 * @fileoverview Chain shapes whose generated text has to bind the way the graph
 * reads: a try/catch branch that pipes, the chain feeding a function call's root
 * input, and a chain that ends on a variable binding.
 *
 * Each case asserts the generated text and then compiles and runs it through the
 * real jq WASM runtime, which both rejects text jq cannot parse and shows where
 * a mis-bound operator sends the value.
 */

import { describe, it, expect } from 'vitest';
import { convertFlowToJQ } from './index';
import { JQHandleIdPrefix, ValueType } from '../../../enums';
import {
  createStartNode,
  createStringNode,
  createValueNode,
  createPathNode,
  createFunctionCallNode,
  createOperatorNode,
  createTryCatchNode,
  createChainEdge,
  createEdge,
  createFlowEdge,
  createPathSegment,
  execJq,
} from '../test-helpers';

/** `.<field>` as a Value node, named only when `name` is given. */
const field = (id: string, name: string, fieldName: string) =>
  createPathNode(
    id,
    [createPathSegment(`${id}_s1`, 'root', ''), createPathSegment(`${id}_s2`, 'field', fieldName)],
    { name },
  );

/** `.` as an unnamed Value node — the right operand a unary operator ignores. */
const identity = (id: string) =>
  createPathNode(id, [createPathSegment(`${id}_s1`, 'root', '')], { name: '' });

describe('Piped try/catch branches', () => {
  it('should keep a piped catch chain inside the catch', async () => {
    const nodes = [
      createStartNode(),
      createTryCatchNode('tc', { name: '' }),
      field('t1', '', 'a'),
      createFunctionCallNode('t2', 'length', { name: '' }),
      createStringNode('c1', 'oops', { name: '' }),
      createFunctionCallNode('c2', 'ascii_upcase', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'tc'),
      createEdge('e2', 'tc', 't1', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
      createChainEdge('e3', 't1', 't2'),
      createEdge('e4', 'tc', 'c1', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
      createChainEdge('e5', 'c1', 'c2'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // jq reads `try a catch b | c` as `(try a catch b) | c`, so an unwrapped
    // catch chain applies its tail to the value the try body produced too.
    expect(result).toBe('try (.a | length) catch ("oops" | ascii_upcase)');
    // Try body succeeds — the catch chain must not touch its value.
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(5);
    // `length` of a boolean is a jq error — the catch chain runs in full.
    await expect(execJq(result, { a: true })).resolves.toBe('OOPS');
  });

  it('should leave a single-expression catch branch unwrapped', async () => {
    const nodes = [
      createStartNode(),
      createTryCatchNode('tc', { name: '' }),
      field('t1', '', 'a'),
      createFunctionCallNode('t2', 'length', { name: '' }),
      createStringNode('cv', 'oops', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'tc'),
      createEdge('e2', 'tc', 't1', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
      createChainEdge('e3', 't1', 't2'),
      createEdge('e4', 'tc', 'cv', JQHandleIdPrefix.Catch, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('try (.a | length) catch "oops"');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(5);
    await expect(execJq(result, { a: true })).resolves.toBe('oops');
  });
});

describe('Function-call root input chains', () => {
  it('should pipe the whole root chain into the call', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'length', { name: '' }),
      field('rv', '', 'a'),
      createFunctionCallNode('rv2', 'keys', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'rv', `${JQHandleIdPrefix.Root}:f1`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'rv', 'rv2'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('.a | keys | length');
    await expect(execJq(result, { a: { z: 1, y: 2 } })).resolves.toBe(2);
  });

  it('should bind a named root node before piping it into the call', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'length', { name: '' }),
      field('rv', 'rootInput', 'a'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'rv', `${JQHandleIdPrefix.Root}:f1`, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('.a as $rootInput | $rootInput | length');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe(5);
  });
});

describe('Operator operands that pipe', () => {
  it('should keep a call fed by a root input inside the operand', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('len', 'length', { name: '' }),
      field('items', '', 'items'),
      createOperatorNode('op', '==', { name: '' }),
      field('n', '', 'n'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'len'),
      createEdge('e2', 'len', 'items', `${JQHandleIdPrefix.Root}:len`, JQHandleIdPrefix.Top),
      createEdge('e3', 'len', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      createEdge('e4', 'n', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // `|` binds looser than every operator, so an unparenthesised operand leaves
    // `(.items | length == .n)` — `.n` read off the array `.items` yields.
    expect(result).toBe('((.items | length) == .n)');
    await expect(execJq(result, { items: [3, 1, 2], n: 3 })).resolves.toBe(true);
    await expect(execJq(result, { items: [3, 1, 2], n: 2 })).resolves.toBe(false);
  });

  it('should keep a multi-node root chain inside the operand', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('len', 'length', { name: '' }),
      field('items', '', 'items'),
      createFunctionCallNode('srt', 'sort', { name: '' }),
      createOperatorNode('op', '==', { name: '' }),
      field('n', '', 'n'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'len'),
      createEdge('e2', 'len', 'items', `${JQHandleIdPrefix.Root}:len`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'items', 'srt'),
      createEdge('e4', 'len', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      createEdge('e5', 'n', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('((.items | sort | length) == .n)');
    await expect(execJq(result, { items: [3, 1, 2], n: 3 })).resolves.toBe(true);
  });

  it('should keep a named root binding inside the operand', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('len', 'length', { name: '' }),
      field('items', 'xs', 'items'),
      createOperatorNode('op', '==', { name: '' }),
      field('n', '', 'n'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'len'),
      createEdge('e2', 'len', 'items', `${JQHandleIdPrefix.Root}:len`, JQHandleIdPrefix.Top),
      createEdge('e3', 'len', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      createEdge('e4', 'n', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // The binding is closed with `| $xs`, so the operand pipes just as a drawn
    // chain does and needs the same parentheses.
    expect(result).toBe('((.items as $xs | $xs | length) == .n)');
    await expect(execJq(result, { items: [3, 1, 2], n: 3 })).resolves.toBe(true);
  });

  it('should suppress errors from the whole operand chain', async () => {
    const nodes = [
      createStartNode(),
      createValueNode('arr', ValueType.Array, undefined, { name: '', items: [{ id: 'it0' }] }),
      createFunctionCallNode('len', 'length', { name: '' }),
      field('a', '', 'a'),
      createOperatorNode('op', '?', { name: '' }),
      identity('dot'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'arr'),
      createEdge('e2', 'arr', 'len', `${JQHandleIdPrefix.Item}:it0`, JQHandleIdPrefix.Top),
      createEdge('e3', 'len', 'a', `${JQHandleIdPrefix.Root}:len`, JQHandleIdPrefix.Top),
      createEdge('e4', 'len', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      createEdge('e5', 'dot', 'op', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight),
    ];

    const result = convertFlowToJQ(nodes, edges);

    // `?` is postfix on a term, so an unparenthesised operand leaves
    // `.a | length?` — the error `.a` itself raises escapes the suppression.
    expect(result).toBe('[(.a | length)?]');
    await expect(execJq(result, { a: 'hello' })).resolves.toEqual([5]);
    await expect(execJq(result, 'x')).resolves.toEqual([]);
  });
});

describe('Chains ending on a variable binding', () => {
  it('should yield the bound value at the end of the main chain', async () => {
    const nodes = [createStartNode(), createStringNode('v1', 'hello', { name: 'myValue' })];
    const edges = [createFlowEdge('e1', 'start', 'v1')];

    const result = convertFlowToJQ(nodes, edges);

    // `"hello" as $myValue` binds over a body jq then expects — on its own it is
    // a syntax error, and the value the chain owes its caller is the bound one.
    expect(result).toBe('"hello" as $myValue | $myValue');
    await expect(execJq(result, {})).resolves.toBe('hello');
  });

  it('should yield the bound value at the end of a parameter chain', async () => {
    const nodes = [
      createStartNode(),
      createFunctionCallNode('f1', 'map', { name: '' }),
      field('p0', 'picked', 'n'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'f1'),
      createEdge('e2', 'f1', 'p0', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('map(.n as $picked | $picked)');
    await expect(execJq(result, [{ n: 1 }, { n: 2 }])).resolves.toEqual([1, 2]);
  });

  it('should yield the bound value at the end of a branch chain', async () => {
    const nodes = [
      createStartNode(),
      createTryCatchNode('tc', { name: '' }),
      field('t1', 'guarded', 'a'),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'tc'),
      createEdge('e2', 'tc', 't1', JQHandleIdPrefix.Try, JQHandleIdPrefix.Top),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('try (.a as $guarded | $guarded)');
    await expect(execJq(result, { a: 'hello' })).resolves.toBe('hello');
  });

  it('should leave a binding mid-chain reading the chain input', async () => {
    const nodes = [
      createStartNode(),
      field('v1', 'bound', 'a'),
      createFunctionCallNode('f1', 'keys', { name: '' }),
    ];
    const edges = [createFlowEdge('e1', 'start', 'v1'), createChainEdge('e2', 'v1', 'f1')];

    const result = convertFlowToJQ(nodes, edges);

    // Without `pipeAfterDeclare` the binding does not redirect the chain, so
    // `keys` still reads the object the chain was given.
    expect(result).toBe('.a as $bound\n| keys');
    await expect(execJq(result, { a: 'hello', b: 1 })).resolves.toEqual(['a', 'b']);
  });
});
