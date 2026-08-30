/**
 * @fileoverview The handle-tooltip copy table: every jq handle a node draws must
 * resolve to a `{title, body}` explanation (kind-specific first, generic role
 * fallback second), and an unknown id must resolve to nothing.
 */
import { describe, expect, it } from 'vitest';
import { JQNodeType, JQHandleIdPrefix } from './enums';
import { getJqHandleTooltip, jqPortLabel, roleFromHandleId } from './handle-tooltips';

describe('roleFromHandleId', () => {
  it('reduces a bare prefix token to its role', () => {
    expect(roleFromHandleId(JQHandleIdPrefix.Functions)).toBe('functions');
    expect(roleFromHandleId(JQHandleIdPrefix.Flow)).toBe('flow');
  });

  it('reduces a suffixed composite id to its prefix role', () => {
    expect(roleFromHandleId(`${JQHandleIdPrefix.OperatorLeft}:node-1`)).toBe('left');
    expect(roleFromHandleId(`${JQHandleIdPrefix.Logic}:node-1:expression`)).toBe('logic');
    expect(roleFromHandleId(`${JQHandleIdPrefix.Item}:item-9`)).toBe('item');
  });

  it('returns null for an unknown or empty id', () => {
    expect(roleFromHandleId('made-up---')).toBeNull();
    expect(roleFromHandleId(null)).toBeNull();
    expect(roleFromHandleId(undefined)).toBeNull();
  });
});

describe('getJqHandleTooltip', () => {
  it('gives kind-specific copy for the Input node source handles', () => {
    const functions = getJqHandleTooltip(JQNodeType.Start, JQHandleIdPrefix.Functions);
    const flow = getJqHandleTooltip(JQNodeType.Start, JQHandleIdPrefix.Flow);
    expect(functions?.title).toBe('Functions');
    expect(flow?.title).toBe('Result');
    expect(flow?.body.length).toBeGreaterThan(0);
  });

  it('gives operand copy for operator side handles', () => {
    const left = getJqHandleTooltip(JQNodeType.Operator, JQHandleIdPrefix.OperatorLeft);
    const right = getJqHandleTooltip(JQNodeType.Operator, JQHandleIdPrefix.OperatorRight);
    expect(left?.title).toBe('Left operand');
    expect(right?.title).toBe('Right operand');
  });

  it('names Condition and Try/Catch branch handles', () => {
    expect(getJqHandleTooltip(JQNodeType.Condition, `${JQHandleIdPrefix.If}:0`)?.title).toBe('If');
    expect(getJqHandleTooltip(JQNodeType.Condition, `${JQHandleIdPrefix.Then}:0`)?.title).toBe(
      'Then',
    );
    expect(getJqHandleTooltip(JQNodeType.TryCatch, JQHandleIdPrefix.Try)?.title).toBe('Try');
    expect(getJqHandleTooltip(JQNodeType.TryCatch, JQHandleIdPrefix.Catch)?.title).toBe('Catch');
  });

  it('falls back to generic role copy (top/bottom = input/output)', () => {
    expect(getJqHandleTooltip(JQNodeType.Value, JQHandleIdPrefix.Top)?.title).toBe('Input');
    expect(getJqHandleTooltip(JQNodeType.Value, JQHandleIdPrefix.Bottom)?.title).toBe('Output');
  });

  it('gives Define Function its own grant-input copy, not the generic pipe wording', () => {
    const grant = getJqHandleTooltip(JQNodeType.FunctionDecl, JQHandleIdPrefix.Top);
    expect(grant?.title).toBe('Grant');
    expect(grant?.body).toMatch(/available to the whole expression/);
    // The generic "piped into this node" copy still applies to ordinary kinds.
    expect(getJqHandleTooltip(JQNodeType.Value, JQHandleIdPrefix.Top)?.body).toMatch(/piped into/);
  });

  it('returns null for an unrecognised handle id', () => {
    expect(getJqHandleTooltip(JQNodeType.Value, 'nonsense---')).toBeNull();
  });
});

describe('jqPortLabel', () => {
  it('labels the Condition predicate / branch ports', () => {
    expect(jqPortLabel(`${JQHandleIdPrefix.If}:0`)).toBe('if');
    expect(jqPortLabel(`${JQHandleIdPrefix.Then}:0`)).toBe('then');
    expect(jqPortLabel(JQHandleIdPrefix.Else)).toBe('else');
  });

  it('reads the second and later predicates as "else if" (multi-branch arity)', () => {
    expect(jqPortLabel(`${JQHandleIdPrefix.If}:1`)).toBe('else if');
    expect(jqPortLabel(`${JQHandleIdPrefix.If}:3`)).toBe('else if');
    // Each branch keeps a plain "then" — mirrors the expanded card's stacked rows.
    expect(jqPortLabel(`${JQHandleIdPrefix.Then}:2`)).toBe('then');
  });

  it('labels the Try/Catch and Define Function body ports', () => {
    expect(jqPortLabel(JQHandleIdPrefix.Try)).toBe('try');
    expect(jqPortLabel(JQHandleIdPrefix.Catch)).toBe('catch');
    expect(jqPortLabel(`${JQHandleIdPrefix.Logic}:node-1:expression`)).toBe('body');
  });

  it('numbers a call’s positional args 1-based (arg 1..n ordinal fallback)', () => {
    expect(jqPortLabel(`${JQHandleIdPrefix.Param}:0`)).toBe('arg 1');
    expect(jqPortLabel(`${JQHandleIdPrefix.Param}:1`)).toBe('arg 2');
    expect(jqPortLabel(`${JQHandleIdPrefix.Param}:4`)).toBe('arg 5');
  });

  it('leaves ports whose slot must be named BY THE NODE (operands, keys, indices) id-unlabelled', () => {
    // Operator operands ride TARGET handles (a source-keyed chip would mislabel a
    // crossed wire) and object/array slots have opaque-uuid ids — the label is
    // set on the card, so the id-derived helper returns null here.
    expect(jqPortLabel(`${JQHandleIdPrefix.OperatorLeft}:node-1`)).toBeNull();
    expect(jqPortLabel(`${JQHandleIdPrefix.OperatorRight}:node-1`)).toBeNull();
    expect(jqPortLabel(`${JQHandleIdPrefix.Item}:item-1`)).toBeNull();
    expect(jqPortLabel(`${JQHandleIdPrefix.Field}:field-1`)).toBeNull();
    expect(jqPortLabel(JQHandleIdPrefix.Top)).toBeNull();
    expect(jqPortLabel(JQHandleIdPrefix.Bottom)).toBeNull();
    expect(jqPortLabel(null)).toBeNull();
    expect(jqPortLabel(undefined)).toBeNull();
  });
});
