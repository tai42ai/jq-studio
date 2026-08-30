// @vitest-environment node
/**
 * @fileoverview Which chain a Comment node lands in when an expression is reopened.
 *
 * A `#` comment is a stage of the chain it is written in, so reopening an
 * expression has to put it back in that chain — the branch, the argument, the
 * item, the field or the operand it annotates — not on the main chain. Each case
 * reopens an expression the generator emits, regenerates it, and expects the same
 * text back; a comment that moved chains would come back on a different line.
 *
 * Every case then runs the original and the regenerated text through the real jq
 * WASM runtime, which rejects a comment that swallowed the syntax after it.
 */

import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './index';
import { convertFlowToJQ } from '../jq-from-flow/index';
import { execJq } from '../test-helpers';
import { JQNodeType, JQHandleIdPrefix } from '../../../enums';
import { type JQNode, type JQEdge, type JQCommentData } from '../../../types';

/** The one Comment node of a converted graph, with the edge that reaches it. */
function soleComment(nodes: JQNode[], edges: JQEdge[]) {
  const commentNodes = nodes.filter((n) => n.data.type === JQNodeType.Comment);
  expect(commentNodes).toHaveLength(1);
  const commentNode = commentNodes[0];
  if (!commentNode) throw new Error('unreachable: length asserted above');
  const incoming = edges.filter((e) => e.target === commentNode.id);
  expect(incoming).toHaveLength(1);
  return { node: commentNode, incomingEdge: incoming[0] };
}

/** The node a handle of `sourceId` connects to. */
function handleTarget(nodes: JQNode[], edges: JQEdge[], sourceId: string, handle: string): JQNode {
  const edge = edges.find((e) => e.source === sourceId && e.sourceHandle === handle);
  if (!edge) throw new Error(`no edge from ${sourceId} on handle ${handle}`);
  const node = nodes.find((n) => n.id === edge.target);
  if (!node) throw new Error(`edge from ${sourceId} targets missing node ${edge.target}`);
  return node;
}

/** Reopens an expression, regenerates it, and expects the text back unchanged. */
function reopen(original: string) {
  const { nodes, edges } = convertJQToFlow(original);
  expect(convertFlowToJQ(nodes, edges)).toBe(original);
  return { nodes, edges };
}

describe('Comment insertion inside an operand chain', () => {
  it('should round-trip a comment inside an operator operand', async () => {
    const original = '((.a # note\n| length) > 2)';

    const { nodes, edges } = convertJQToFlow(original);
    const regenerated = convertFlowToJQ(nodes, edges);

    expect(regenerated).toBe(original);
    await expect(execJq(original, { a: 'hello' })).resolves.toBe(true);
    await expect(execJq(regenerated, { a: 'hello' })).resolves.toBe(true);
    await expect(execJq(original, { a: 'hi' })).resolves.toBe(false);
    await expect(execJq(regenerated, { a: 'hi' })).resolves.toBe(false);
  });

  it('should round-trip a comment on the main chain after an operator', async () => {
    const original = '(.a > 2)\n# note\n| tostring';

    const { nodes, edges } = convertJQToFlow(original);
    const regenerated = convertFlowToJQ(nodes, edges);

    expect(regenerated).toBe(original);
    await expect(execJq(original, { a: 5 })).resolves.toBe('true');
    await expect(execJq(regenerated, { a: 5 })).resolves.toBe('true');
  });
});

describe('Comment insertion inside a condition branch', () => {
  it('should keep a then-branch comment in the then branch', async () => {
    const original = 'if .c then\n  .a # note\n\nelse\n  "fallback"\nend';

    const { nodes, edges } = reopen(original);

    const condition = nodes.find((n) => n.data.type === JQNodeType.Condition);
    expect(condition).toBeDefined();
    const thenNode = handleTarget(nodes, edges, condition?.id ?? '', `${JQHandleIdPrefix.Then}:0`);
    const { node: comment, incomingEdge } = soleComment(nodes, edges);
    expect((comment.data as JQCommentData).text).toBe('note');
    expect(incomingEdge?.source).toBe(thenNode.id);

    await expect(execJq(original, { c: true, a: 'yes' })).resolves.toBe('yes');
    await expect(execJq(original, { c: false, a: 'yes' })).resolves.toBe('fallback');
  });

  it('should keep a then-branch comment ahead of the rest of that branch chain', async () => {
    const original = 'if .c then\n  .a # note\n| length\nelse\n  "fallback"\nend';

    reopen(original);

    await expect(execJq(original, { c: true, a: 'hello' })).resolves.toBe(5);
    await expect(execJq(original, { c: false, a: 'hello' })).resolves.toBe('fallback');
  });

  it('should keep an else-branch comment in the else branch', async () => {
    const original = 'if .c then\n  "yes"\nelse\n  .a # note\n\nend';

    const { nodes, edges } = reopen(original);

    const condition = nodes.find((n) => n.data.type === JQNodeType.Condition);
    const elseNode = handleTarget(nodes, edges, condition?.id ?? '', JQHandleIdPrefix.Else);
    const { incomingEdge } = soleComment(nodes, edges);
    expect(incomingEdge?.source).toBe(elseNode.id);

    await expect(execJq(original, { c: false, a: 'fallback' })).resolves.toBe('fallback');
  });
});

describe('Comment insertion inside a try/catch branch', () => {
  it('should keep a try-body comment in the try branch', async () => {
    const original = 'try (.a # note\n| length) catch "oops"';

    const { nodes, edges } = reopen(original);

    const tryCatch = nodes.find((n) => n.data.type === JQNodeType.TryCatch);
    const tryNode = handleTarget(nodes, edges, tryCatch?.id ?? '', JQHandleIdPrefix.Try);
    const { incomingEdge } = soleComment(nodes, edges);
    expect(incomingEdge?.source).toBe(tryNode.id);

    await expect(execJq(original, { a: 'hello' })).resolves.toBe(5);
    await expect(execJq(original, { a: true })).resolves.toBe('oops');
  });

  it('should keep a catch-body comment in the catch branch', async () => {
    const original = 'try (.a | length) catch ("oops" # note\n| ascii_upcase)';

    const { nodes, edges } = reopen(original);

    const tryCatch = nodes.find((n) => n.data.type === JQNodeType.TryCatch);
    const catchNode = handleTarget(nodes, edges, tryCatch?.id ?? '', JQHandleIdPrefix.Catch);
    const { incomingEdge } = soleComment(nodes, edges);
    expect(incomingEdge?.source).toBe(catchNode.id);

    await expect(execJq(original, { a: 'hello' })).resolves.toBe(5);
    await expect(execJq(original, { a: true })).resolves.toBe('OOPS');
  });
});

describe('Comment insertion inside a call argument', () => {
  it('should keep an argument comment in the argument chain', async () => {
    const original = 'map(.a # note\n| length)';

    const { nodes, edges } = reopen(original);

    const call = nodes.find((n) => n.data.type === JQNodeType.FunctionCall);
    const argNode = handleTarget(nodes, edges, call?.id ?? '', `${JQHandleIdPrefix.Param}:0`);
    const { incomingEdge } = soleComment(nodes, edges);
    expect(incomingEdge?.source).toBe(argNode.id);

    await expect(execJq(original, [{ a: 'hello' }])).resolves.toEqual([5]);
  });

  it('should keep a comment that ends an argument chain in that argument', async () => {
    const original = 'sub("a" # note\n; "b")';

    reopen(original);

    await expect(execJq(original, 'abc')).resolves.toBe('bbc');
  });
});

describe('Comment insertion inside array items and object fields', () => {
  it('should keep an item comment in the item chain', async () => {
    const original = '[\n  (.a # note\n| length),\n  "tail"\n]';

    const { nodes, edges } = reopen(original);

    const array = nodes.find(
      (n) => n.data.type === JQNodeType.Value && n.data.valueType === 'array',
    );
    const itemNode = handleTarget(nodes, edges, array?.id ?? '', `${JQHandleIdPrefix.Item}:item_0`);
    const { incomingEdge } = soleComment(nodes, edges);
    expect(incomingEdge?.source).toBe(itemNode.id);

    await expect(execJq(original, { a: 'hello' })).resolves.toEqual([5, 'tail']);
  });

  it('should keep a comment that opens a field chain in that field', async () => {
    const original = '{\n  "a": (# note\n  if true then\n    "yes"\n  else\n    "no"\n  end)\n}';

    const { nodes, edges } = reopen(original);

    const object = nodes.find(
      (n) => n.data.type === JQNodeType.Value && n.data.valueType === 'object',
    );
    const { node: comment, incomingEdge } = soleComment(nodes, edges);
    expect(incomingEdge?.source).toBe(object?.id);
    expect(incomingEdge?.sourceHandle).toContain(JQHandleIdPrefix.Field);
    expect((comment.data as JQCommentData).text).toBe('note');

    await expect(execJq(original, {})).resolves.toEqual({ a: 'yes' });
  });

  it('should keep a comment written after a field key in that field chain', async () => {
    const original = '{\n  name # who\n  : .n\n}';

    const { nodes, edges } = convertJQToFlow(original);
    const regenerated = convertFlowToJQ(nodes, edges);

    expect(regenerated).toBe('{\n  "name": # who\n.n\n}');

    const object = nodes.find(
      (n) => n.data.type === JQNodeType.Value && n.data.valueType === 'object',
    );
    const { node: comment, incomingEdge } = soleComment(nodes, edges);
    expect(incomingEdge?.source).toBe(object?.id);
    expect(incomingEdge?.sourceHandle).toContain(JQHandleIdPrefix.Field);
    expect((comment.data as JQCommentData).text).toBe('who');

    await expect(execJq(original, { n: 'ada' })).resolves.toEqual({ name: 'ada' });
    await expect(execJq(regenerated, { n: 'ada' })).resolves.toEqual({ name: 'ada' });
  });

  it('should keep both key-side comments of a field, in the order written', async () => {
    const original = '{\n  # lead\n  name # who\n  : .n\n}';

    const { nodes, edges } = convertJQToFlow(original);
    const regenerated = convertFlowToJQ(nodes, edges);

    expect(regenerated).toBe('{\n  "name": # lead\n# who\n.n\n}');

    const texts = nodes
      .filter((n) => n.data.type === JQNodeType.Comment)
      .map((n) => (n.data as JQCommentData).text);
    expect(texts).toEqual(['lead', 'who']);

    await expect(execJq(original, { n: 'ada' })).resolves.toEqual({ name: 'ada' });
    await expect(execJq(regenerated, { n: 'ada' })).resolves.toEqual({ name: 'ada' });
  });
});

describe('Comment insertion inside a function declaration body', () => {
  it('should keep a body comment in the declaration body chain', async () => {
    const original = 'def my_func:\n  .a # note\n| length;\n\nmy_func';

    const { nodes, edges } = reopen(original);

    const decl = nodes.find((n) => n.data.type === JQNodeType.FunctionDecl);
    const { incomingEdge } = soleComment(nodes, edges);
    const bodyEntry = edges.find(
      (e) => e.source === decl?.id && e.sourceHandle?.startsWith(JQHandleIdPrefix.Logic),
    );
    expect(incomingEdge?.source).toBe(bodyEntry?.target);

    await expect(execJq(original, { a: 'hello' })).resolves.toBe(5);
  });

  it('should move a comment written above a declaration to the head of the main chain', async () => {
    // A declaration hangs off the Start node's functions handle, which is no
    // chain — the main chain is the nearest one that can hold the comment.
    const original = '# header\ndef my_func:\n  .a;\n\nmy_func';

    const { nodes, edges } = convertJQToFlow(original);
    const { node: comment, incomingEdge } = soleComment(nodes, edges);

    expect((comment.data as JQCommentData).text).toBe('header');
    const start = nodes.find((n) => n.data.type === JQNodeType.Start);
    expect(incomingEdge?.source).toBe(start?.id);
    expect(incomingEdge?.sourceHandle).toBe(JQHandleIdPrefix.Flow);

    const regenerated = convertFlowToJQ(nodes, edges);
    expect(regenerated).toBe('def my_func: .a;\n\n# header\nmy_func');
    // The move settles on the first reopen: regenerating it again is a fixed point
    const second = convertJQToFlow(regenerated);
    expect(convertFlowToJQ(second.nodes, second.edges)).toBe(regenerated);
    await expect(execJq(regenerated, { a: 'hello' })).resolves.toBe('hello');
  });
});
