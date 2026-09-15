/**
 * @fileoverview Shared node/edge builders and error extractors for the flow
 * validation tests.
 */

import { ValueType } from '../enums';
import { type JQEdge } from '../types';
import {
  createConditionNode,
  createFunctionCallNode,
  createOperatorNode,
  createStartNode,
  createValueNode,
} from './converters/test-helpers';
import { type ValidationErrorMap } from './flow-validator';

/** The error messages recorded for `nodeId`. */
export const errorsFor = (map: ValidationErrorMap, nodeId: string) =>
  (map.get(nodeId) ?? []).map((e) => e.message);

/** The error severities recorded for `nodeId`. */
export const severitiesFor = (map: ValidationErrorMap, nodeId: string) =>
  (map.get(nodeId) ?? []).map((e) => e.severity);

// Convenience wrappers (validator tests only care about id + name).

export const startNode = (id = 'start') => createStartNode(id);

export const valueNode = (id: string, name: string) =>
  createValueNode(id, ValueType.Path, '.', { name });

export const functionCallNode = (id: string, name: string, selectedFunction?: string) =>
  createFunctionCallNode(id, selectedFunction ?? '', { name, callType: 'builtin' });

export const operatorNode = (id: string, name: string) => createOperatorNode(id, '+', { name });

export const conditionNode = (id: string, name: string, branchCount = 1) =>
  createConditionNode(
    id,
    Array.from({ length: branchCount }, (_, i) => ({ id: `branch_${String(i)}` })),
    { name },
  );

export const edge = (
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string,
): JQEdge => ({
  id: `e-${source}-${target}-${sourceHandle ?? ''}`,
  source,
  target,
  sourceHandle: sourceHandle ?? undefined,
  targetHandle: targetHandle ?? undefined,
});
