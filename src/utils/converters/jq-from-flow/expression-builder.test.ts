// @vitest-environment node
/**
 * @fileoverview Tests for the expression builder's wrapping rule and the guard on
 * a chain expression's first line.
 *
 * `joinExpressionParts` rejects a chain of comments only wherever a chain is
 * built, so no expression reaching `firstExpressionLine` is made of comments —
 * the guard is exercised against the function directly. Answering with an empty
 * line instead would hand {@link asTerm}'s keyword test a head no expression has,
 * and the wrapping rule would read the wrong answer off it in silence.
 *
 * The wrapping rule asks whether an expression carries a `|` outside every
 * bracket, string literal and comment. Text a comment or a string literal holds
 * is jq's to read as data, not as code, so the bracket count has to skip both —
 * a stray `(` or `"` inside one otherwise hides the pipe that follows it and the
 * expression goes into its position unparenthesised. Each case here asserts the
 * generated text and then compiles and runs it through the real jq WASM runtime.
 *
 * A count driven below zero can answer nothing, so the rule is asserted against
 * {@link asTerm} directly there: the answer it gives is the one that wraps.
 */

import { describe, it, expect } from 'vitest';
import { asTerm, firstExpressionLine } from './expression-builder';
import { convertFlowToJQ } from './index';
import { JQHandleIdPrefix, ValueType } from '../../../enums';
import {
  createStartNode,
  createValueNode,
  createStringNode,
  createPathNode,
  createPathSegment,
  createFunctionCallNode,
  createCommentNode,
  createChainEdge,
  createEdge,
  createFlowEdge,
  execJq,
} from '../test-helpers';

/** `.a` as an unnamed Value node, so it contributes no `as $var` binding. */
const fieldA = (id: string) =>
  createPathNode(
    id,
    [createPathSegment(`${id}_s1`, 'root', ''), createPathSegment(`${id}_s2`, 'field', 'a')],
    { name: '' },
  );

/** An object with a single field `k`, unnamed so it binds no variable. */
const objK = (id: string) =>
  createValueNode(id, ValueType.Object, undefined, {
    name: '',
    fields: [{ id: 'f0', name: 'k' }],
  });

describe('firstExpressionLine', () => {
  it('should return the first line that is not a comment', () => {
    expect(firstExpressionLine('# note\n  if true then\n  1\nend')).toBe('if true then');
  });

  it('should reject an expression whose every line is a comment or blank', () => {
    expect(() => firstExpressionLine('# note\n\n# more\n')).toThrow(
      'Expression has no line that is not a comment',
    );
  });
});

describe('The wrapping rule reading past comments and string literals', () => {
  it('should parenthesise a field chain whose comment holds an unbalanced bracket and quote', async () => {
    // A Comment node's text is the flow author's, so it may hold anything. Counted as
    // code, the `(` opens a bracket and the `"` opens a string that never closes, and
    // the `| length` that follows lands inside both — the field value would go in
    // unparenthesised, and jq reads a bare pipe in a field value as a syntax error.
    const nodes = [
      createStartNode(),
      objK('obj'),
      createCommentNode('c1', 'note ( unbalanced " quote'),
      fieldA('v'),
      createFunctionCallNode('len', 'length', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'obj'),
      createEdge('e2', 'obj', 'c1', `${JQHandleIdPrefix.Field}:f0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 'c1', 'v'),
      createChainEdge('e4', 'v', 'len'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('{\n  "k": (# note ( unbalanced " quote\n.a | length)\n}');
    await expect(execJq(result, { a: 'hello' })).resolves.toEqual({ k: 5 });
  });

  it('should parenthesise a field chain whose string literal holds an unbalanced bracket', async () => {
    // The `(` here is a character of the string's value, not a bracket. Counted as
    // code it opens a nesting the `| length` never leaves, so the pipe reads as one
    // jq already delimits and the field value would go in unparenthesised.
    const nodes = [
      createStartNode(),
      objK('obj'),
      createStringNode('s', '(', { name: '' }),
      createFunctionCallNode('len', 'length', { name: '' }),
    ];
    const edges = [
      createFlowEdge('e1', 'start', 'obj'),
      createEdge('e2', 'obj', 's', `${JQHandleIdPrefix.Field}:f0`, JQHandleIdPrefix.Top),
      createChainEdge('e3', 's', 'len'),
    ];

    const result = convertFlowToJQ(nodes, edges);

    expect(result).toBe('{"k": ("(" | length)}');
    await expect(execJq(result, {})).resolves.toEqual({ k: 1 });
  });
});

describe('The wrapping rule reading a bracket count it cannot trust', () => {
  it('should parenthesise an expression whose closing bracket opens no nesting', () => {
    // The stray `)` leaves the count below the level the expression started at, so
    // the `|` after it reads as one a bracket already encloses and the expression
    // would go into its position unparenthesised.
    expect(asTerm('.a) | length')).toBe('(.a) | length)');
  });
});
