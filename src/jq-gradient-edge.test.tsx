/**
 * @fileoverview Covers the gradient edge's exit-direction routing. A source
 * handle fixed on one side of its card can feed a node laid out on another side
 * (the Start node's right-facing "Flow" handle over a successor placed directly
 * below); routing the wire out of the declared side then folds it into a cusp.
 * `resolveExitPosition` re-derives the exit toward the partner only when the
 * declared side faces away, so well-behaved wires are left untouched.
 *
 * Wire ROLE labelling no longer rides a separate edge chip: the port's role is
 * named once, on the card edge, by the collapsed-handle rail (see `PortLabels`) —
 * so there is no `edgeChipLabel` to test here and no duplicate label per port.
 */
import { describe, expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import { resolveExitPosition } from './jq-gradient-edge';

describe('resolveExitPosition', () => {
  it('re-routes a right-facing source down toward a successor placed below-left', () => {
    // The Start "Flow" handle (Position.Right) feeding the main-pipeline node
    // directly below it — the case that produced the stray red hook.
    expect(resolveExitPosition(Position.Right, 250, 110, 150, 210)).toBe(Position.Bottom);
  });

  it('keeps a right-facing source that already points at a target to its right', () => {
    // An object field handle feeding a child value node laid out to the right —
    // already correct, so it must not be disturbed.
    expect(resolveExitPosition(Position.Right, 250, 250, 690, 200)).toBe(Position.Right);
  });

  it('keeps any side that already faces its partner', () => {
    expect(resolveExitPosition(Position.Left, 250, 110, 100, 110)).toBe(Position.Left);
    expect(resolveExitPosition(Position.Top, 250, 210, 250, 50)).toBe(Position.Top);
    expect(resolveExitPosition(Position.Bottom, 250, 50, 250, 210)).toBe(Position.Bottom);
  });

  it('flips a side that points away to the dominant axis of the real gap', () => {
    // Left handle but the partner is far to the right and only slightly below →
    // horizontal dominates, so the exit faces right.
    expect(resolveExitPosition(Position.Left, 100, 100, 500, 140)).toBe(Position.Right);
    // Top handle but the partner is well below → vertical dominates, exit down.
    expect(resolveExitPosition(Position.Top, 100, 100, 140, 400)).toBe(Position.Bottom);
  });
});
