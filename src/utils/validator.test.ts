/**
 * @fileoverview Covers `dropEdgesOnTargetSlot`, the replace-on-connect rule for
 * single-input jq target ports: a second wire into the same operand / pipe / arg
 * slot replaces the first rather than stacking, so the resolver never reads one
 * of two duplicates arbitrarily.
 */
import { describe, expect, it } from 'vitest';
import { dropEdgesOnTargetSlot } from './validator';
import { JQHandleIdPrefix } from '../enums';
import type { JQEdge } from '../types';

const edge = (id: string, source: string, target: string, targetHandle: string): JQEdge => ({
  id,
  source,
  target,
  sourceHandle: JQHandleIdPrefix.Bottom,
  targetHandle,
});

const OP_LEFT = `${JQHandleIdPrefix.OperatorLeft}:op1`;

describe('dropEdgesOnTargetSlot', () => {
  it('removes an existing wire on the same target slot (replace-on-connect)', () => {
    const edges = [edge('e1', 'a', 'op1', OP_LEFT)];
    const kept = dropEdgesOnTargetSlot(edges, 'op1', OP_LEFT);
    expect(kept).toHaveLength(0);
  });

  it('leaves wires on other slots of the same target untouched', () => {
    const edges = [
      edge('e1', 'a', 'op1', OP_LEFT),
      edge('e2', 'b', 'op1', `${JQHandleIdPrefix.OperatorRight}:op1`),
    ];
    const kept = dropEdgesOnTargetSlot(edges, 'op1', OP_LEFT);
    expect(kept.map((e) => e.id)).toEqual(['e2']);
  });

  it('leaves wires to other targets untouched', () => {
    const edges = [edge('e1', 'a', 'op1', OP_LEFT), edge('e2', 'a', 'op2', OP_LEFT)];
    const kept = dropEdgesOnTargetSlot(edges, 'op1', OP_LEFT);
    expect(kept.map((e) => e.id)).toEqual(['e2']);
  });

  it('is a no-op when the slot is free', () => {
    const edges = [edge('e2', 'b', 'op1', `${JQHandleIdPrefix.OperatorRight}:op1`)];
    expect(dropEdgesOnTargetSlot(edges, 'op1', OP_LEFT)).toHaveLength(1);
  });
});
