/**
 * @fileoverview Convenience node/edge builders shared by the jq-from-flow tests,
 * keeping each test concise.
 */

import { ValueType } from '../../../enums';
import { type JQEdge } from '../../../types';
import {
  createConditionNode,
  createEdge,
  createFlowEdge,
  createFunctionCallNode,
  createOperatorNode,
  createPathSegment,
  createStartNode,
  createTryCatchNode,
  createValueNode,
} from '../test-helpers';

export const start = (id = 'start') => createStartNode(id);

export const str = (id: string, value: string, name?: string) =>
  createValueNode(id, ValueType.String, value, { name: name ?? id });

export const num = (id: string, value: number, name?: string) =>
  createValueNode(id, ValueType.Number, value, { name: name ?? id });

export const bool = (id: string, value: boolean, name?: string) =>
  createValueNode(id, ValueType.Boolean, value, { name: name ?? id });

export const nil = (id: string, name?: string) =>
  createValueNode(id, ValueType.Null, null, { name: name ?? id });

export const path = (id: string, segments: ReturnType<typeof createPathSegment>[], name?: string) =>
  createValueNode(id, ValueType.Path, undefined, { name: name ?? id, pathSegments: segments });

export const arr = (id: string, name?: string) =>
  createValueNode(id, ValueType.Array, undefined, { name: name ?? id, items: [] });

export const func = (
  id: string,
  selected: string,
  opts: { name?: string; callType?: string } = {},
) =>
  createFunctionCallNode(id, selected, {
    name: opts.name ?? id,
    callType: opts.callType ?? 'builtin',
  });

export const op = (id: string, operator: string, name?: string) =>
  createOperatorNode(id, operator, { name: name ?? id });

export const cond = (id: string, branches: { id: string }[], name?: string) =>
  createConditionNode(id, branches, { name: name ?? id });

export const tryCatch = (id: string, name?: string) => createTryCatchNode(id, { name: name ?? id });

/** Shorthand for common path segments */
export const seg = {
  root: (id = 'seg0') => createPathSegment(id, 'root', '.'),
  field: (field: string, id = `seg_${field}`) => createPathSegment(id, 'field', field),
};

/** Flow edge (Start → next) */
export const flow = (id: string, source: string, target: string) =>
  createFlowEdge(id, source, target);

/** Custom edge */
export const edge = (
  id: string,
  source: string,
  target: string,
  srcHandle: string,
  tgtHandle: string,
): JQEdge => createEdge(id, source, target, srcHandle, tgtHandle);
