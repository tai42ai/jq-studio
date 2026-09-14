/**
 * @fileoverview The single-input rule for jq TARGET ports: a new wire onto a
 * slot that already holds one replaces it rather than stacking.
 */

import type { JQEdge } from '../types';

/**
 * A jq TARGET port holds exactly one incoming wire: an operator's `a` / `b`
 * operand, a node's pipe `top`, a Define-Function grant, a call's positional arg
 * slot — each is a single value, never a fan-in. (The only fan-out is the Start
 * node's `functions` port, and that is a SOURCE, not a target.) So when a new
 * wire lands on a `(target, targetHandle)` that already has one, the old wire must
 * be REPLACED, not stacked — otherwise the flow validator's `some()` still passes
 * and the resolver reads whichever duplicate it happens to hit first.
 *
 * Pure and exported so the replace decision is unit-testable without a laid-out
 * canvas. Returns the edges with any wire already on this exact target slot removed.
 */
export const dropEdgesOnTargetSlot = (
  edges: JQEdge[],
  target: string | null | undefined,
  targetHandle: string | null | undefined,
): JQEdge[] =>
  edges.filter(
    (e) => !(e.target === target && (e.targetHandle ?? null) === (targetHandle ?? null)),
  );
