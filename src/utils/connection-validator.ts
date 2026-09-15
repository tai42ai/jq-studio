/**
 * @fileoverview The two jq connection readers, as thin lookups over the shared
 * connection rule tables: which node types a drag from a handle may reach, and
 * whether a specific source→target connection is allowed.
 */

import { JQHandleIdPrefix, JQNodeType, OPERAND_NODE_TYPES } from '../enums';
import {
  classifyHandle,
  HANDLE_TARGET_RULES,
  isOperatorSlotHandle,
  isSourceHandleId,
  isTargetHandleId,
  PIPELINE_NODE_TYPES,
  SOURCE_DRAG_TARGETS,
  TARGET_DRAG_SOURCES,
} from './connection-rules';

/**
 * The node types a source handle reaches by its own rule (handle-prefix kinds
 * plus a FunctionDecl `logic` body), or `null` when the handle carries no such
 * rule and the drag/target tables decide instead.
 */
const handleRuleTargets = (
  nodeType: JQNodeType,
  handleType: 'source' | 'target',
  handleId: string | null,
): JQNodeType[] | null => {
  const kind = classifyHandle(handleId);
  const byHandle = HANDLE_TARGET_RULES[kind];
  if (byHandle) return byHandle;
  if (nodeType === JQNodeType.Operator && handleType === 'target' && handleId !== null) {
    if (isOperatorSlotHandle(handleId)) return [...OPERAND_NODE_TYPES];
  }
  if (kind === 'operatorOperand') return [JQNodeType.Operator];
  if (kind === 'logic' && nodeType === JQNodeType.FunctionDecl) {
    return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
  }
  if (nodeType === JQNodeType.Start && handleType === 'source') {
    if (kind === 'flow') return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
    if (kind === 'functions') return [JQNodeType.FunctionDecl];
  }
  return null;
};

/**
 * The node types a connection drawn from `(sourceNodeType, sourceHandle)` may
 * reach — a handle-specific rule when one applies, otherwise the drag table for
 * the node type (targets when dragging from a source handle, sources when
 * dragging onto a target handle).
 */
export const getValidJQNodeTypesForConnection = (
  sourceNodeType: JQNodeType | null,
  sourceHandleType: 'source' | 'target' | null,
  sourceHandleId: string | null,
): JQNodeType[] => {
  if (!sourceNodeType || !sourceHandleType) return [];

  const byRule = handleRuleTargets(sourceNodeType, sourceHandleType, sourceHandleId);
  if (byRule) return byRule;

  if (sourceHandleType === 'source') return SOURCE_DRAG_TARGETS[sourceNodeType] ?? [];
  return TARGET_DRAG_SOURCES[sourceNodeType] ?? [];
};

/**
 * The target node types a SOURCE handle accepts by its own rule (handle-prefix
 * kinds plus a FunctionDecl `logic` body), or `null` when no such rule applies.
 */
const sourceHandleTargetRule = (
  sourceNodeType: JQNodeType,
  sourceHandleId: string,
): JQNodeType[] | null => {
  const kind = classifyHandle(sourceHandleId);
  if (kind === 'logic' && sourceNodeType === JQNodeType.FunctionDecl) {
    return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
  }
  return HANDLE_TARGET_RULES[kind] ?? null;
};

/** Whether a concrete source→target connection is allowed. */
export const validateJQConnection = (
  sourceNodeType: JQNodeType,
  targetNodeType: JQNodeType,
  sourceHandleId: string,
  targetHandleId: string,
): boolean => {
  // Comment→Comment connections are not allowed (multiline comments use \n in a single node).
  if (sourceNodeType === JQNodeType.Comment && targetNodeType === JQNodeType.Comment) return false;

  const handleRule = sourceHandleTargetRule(sourceNodeType, sourceHandleId);
  if (handleRule) return handleRule.includes(targetNodeType);

  // An operator's operand slot takes an operand node reaching over its own
  // operator handle; the jq generator reads operand nesting off that handle's
  // edges, so any other arriving handle leaves the graph unconvertible.
  if (isOperatorSlotHandle(targetHandleId)) {
    return (
      classifyHandle(sourceHandleId) === 'operatorOperand' &&
      OPERAND_NODE_TYPES.includes(sourceNodeType)
    );
  }

  // An operand's own operator handle only connects to Operator nodes.
  if (classifyHandle(sourceHandleId) === 'operatorOperand') {
    return targetNodeType === JQNodeType.Operator;
  }

  if (!isSourceHandleId(sourceHandleId) || !isTargetHandleId(targetHandleId)) return false;
  if (targetNodeType === JQNodeType.Start) return false;

  if (
    sourceNodeType === JQNodeType.Start &&
    sourceHandleId === (JQHandleIdPrefix.Functions as string)
  ) {
    return targetNodeType === JQNodeType.FunctionDecl;
  }
  if (targetNodeType === JQNodeType.FunctionDecl) {
    return (
      sourceNodeType === JQNodeType.Start &&
      sourceHandleId === (JQHandleIdPrefix.Functions as string)
    );
  }

  return true;
};
