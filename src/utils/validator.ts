import { JQNodeType, JQHandleIdPrefix, OPERAND_NODE_TYPES } from '../enums';
import type { JQEdge } from '../types';

/** Pipeline node types that can appear in the main flow chain (bottom→top connections). */
const PIPELINE_NODE_TYPES = [
  JQNodeType.FunctionCall,
  JQNodeType.Value,
  JQNodeType.Condition,
  JQNodeType.TryCatch,
];

export const getValidJQNodeTypesForConnection = (
  sourceNodeType: JQNodeType | null,
  sourceHandleType: 'source' | 'target' | null,
  sourceHandleId: string | null,
): JQNodeType[] => {
  if (!sourceNodeType || !sourceHandleType) return [];

  // Param handles connect to Value, Condition, TryCatch, or FunctionCall nodes
  if (sourceHandleId?.startsWith(`${JQHandleIdPrefix.Param}:`)) {
    return [JQNodeType.Value, JQNodeType.Condition, JQNodeType.TryCatch, JQNodeType.FunctionCall];
  }

  // Item / field / root handles connect to Value or FunctionCall nodes
  if (
    sourceHandleId?.startsWith(`${JQHandleIdPrefix.Item}:`) ||
    sourceHandleId?.startsWith(`${JQHandleIdPrefix.Field}:`) ||
    sourceHandleId?.startsWith(`${JQHandleIdPrefix.Root}:`)
  ) {
    return [JQNodeType.Value, JQNodeType.FunctionCall];
  }

  // Operator's target handles (OperatorLeft/OperatorRight) accept operand node types
  // Must check BEFORE generic operator handle check since startsWith matches both
  if (
    sourceNodeType === JQNodeType.Operator &&
    sourceHandleType === 'target' &&
    (sourceHandleId === (JQHandleIdPrefix.OperatorLeft as string) ||
      sourceHandleId === (JQHandleIdPrefix.OperatorRight as string))
  ) {
    return [...OPERAND_NODE_TYPES];
  }

  // Operand node operator handles (OperatorLeft/OperatorRight) only connect to Operator nodes
  if (
    sourceHandleId?.startsWith(JQHandleIdPrefix.OperatorLeft) ||
    sourceHandleId?.startsWith(JQHandleIdPrefix.OperatorRight)
  ) {
    return [JQNodeType.Operator];
  }

  // Condition node side handles connect to Value, FunctionCall, Condition, TryCatch
  if (
    sourceHandleId?.startsWith(`${JQHandleIdPrefix.If}:`) ||
    sourceHandleId?.startsWith(`${JQHandleIdPrefix.Then}:`) ||
    sourceHandleId === (JQHandleIdPrefix.Else as string)
  ) {
    return [JQNodeType.Value, JQNodeType.FunctionCall, JQNodeType.Condition, JQNodeType.TryCatch];
  }

  // TryCatch node side handles connect to Value, FunctionCall, Condition, TryCatch
  if (
    sourceHandleId === (JQHandleIdPrefix.Try as string) ||
    sourceHandleId === (JQHandleIdPrefix.Catch as string)
  ) {
    return [JQNodeType.Value, JQNodeType.FunctionCall, JQNodeType.Condition, JQNodeType.TryCatch];
  }

  // Start node handles: "flow" connects to flow nodes + Comment, "functions" connects to FunctionDecl
  if (sourceNodeType === JQNodeType.Start && sourceHandleType === 'source') {
    if (sourceHandleId === (JQHandleIdPrefix.Flow as string)) {
      return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
    }
    if (sourceHandleId === (JQHandleIdPrefix.Functions as string)) {
      return [JQNodeType.FunctionDecl];
    }
  }

  // FunctionDecl's "logic" handle connects to flow nodes + Comment (sub-flow)
  if (
    sourceNodeType === JQNodeType.FunctionDecl &&
    sourceHandleId?.startsWith(JQHandleIdPrefix.Logic)
  ) {
    return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
  }

  // If dragging from source handle (bottom), return valid TARGET node types
  if (sourceHandleType === 'source') {
    switch (sourceNodeType) {
      case JQNodeType.Start:
        return [
          JQNodeType.FunctionCall,
          JQNodeType.Value,
          JQNodeType.FunctionDecl,
          JQNodeType.Condition,
          JQNodeType.TryCatch,
          JQNodeType.Comment,
        ];
      case JQNodeType.FunctionDecl:
        return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
      case JQNodeType.FunctionCall:
        return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
      case JQNodeType.Value:
        return [
          JQNodeType.FunctionCall,
          JQNodeType.Value,
          JQNodeType.Operator,
          JQNodeType.Condition,
          JQNodeType.TryCatch,
          JQNodeType.Comment,
        ];
      case JQNodeType.Operator:
        return [JQNodeType.Value, JQNodeType.Condition, JQNodeType.TryCatch, JQNodeType.Comment];
      case JQNodeType.Condition:
        return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
      case JQNodeType.TryCatch:
        return [...PIPELINE_NODE_TYPES, JQNodeType.Comment];
      // Comment bottom can connect to pipeline nodes but NOT to other Comments
      case JQNodeType.Comment:
        return [...PIPELINE_NODE_TYPES];
      default:
        return [];
    }
  }

  // Dragging from target handle (top): return valid SOURCE node types.
  switch (sourceNodeType) {
    case JQNodeType.Start:
      return [];
    case JQNodeType.FunctionDecl:
      return [JQNodeType.Start];
    case JQNodeType.FunctionCall:
      return [
        JQNodeType.Start,
        JQNodeType.FunctionDecl,
        JQNodeType.FunctionCall,
        JQNodeType.Value,
        JQNodeType.Condition,
        JQNodeType.TryCatch,
        JQNodeType.Comment,
      ];
    case JQNodeType.Value:
      return [
        JQNodeType.Start,
        JQNodeType.FunctionDecl,
        JQNodeType.FunctionCall,
        JQNodeType.Value,
        JQNodeType.Operator,
        JQNodeType.Condition,
        JQNodeType.TryCatch,
        JQNodeType.Comment,
      ];
    case JQNodeType.Operator:
      return [
        JQNodeType.Start,
        JQNodeType.FunctionDecl,
        JQNodeType.FunctionCall,
        JQNodeType.Value,
        JQNodeType.Condition,
        JQNodeType.TryCatch,
        JQNodeType.Comment,
      ];
    case JQNodeType.Condition:
      return [
        JQNodeType.Start,
        JQNodeType.FunctionDecl,
        JQNodeType.FunctionCall,
        JQNodeType.Value,
        JQNodeType.Operator,
        JQNodeType.Condition,
        JQNodeType.TryCatch,
        JQNodeType.Comment,
      ];
    case JQNodeType.TryCatch:
      return [
        JQNodeType.Start,
        JQNodeType.FunctionDecl,
        JQNodeType.FunctionCall,
        JQNodeType.Value,
        JQNodeType.Operator,
        JQNodeType.Condition,
        JQNodeType.TryCatch,
        JQNodeType.Comment,
      ];
    // Comment top can receive from pipeline nodes and Start, but NOT from other Comments
    case JQNodeType.Comment:
      return [JQNodeType.Start, JQNodeType.FunctionDecl, ...PIPELINE_NODE_TYPES];
    default:
      return [];
  }
};

export const validateJQConnection = (
  sourceNodeType: JQNodeType,
  targetNodeType: JQNodeType,
  sourceHandleId: string,
  targetHandleId: string,
): boolean => {
  // Comment→Comment connections are not allowed (multiline comments use \n in a single node)
  if (sourceNodeType === JQNodeType.Comment && targetNodeType === JQNodeType.Comment) {
    return false;
  }

  const isSourceHandle =
    sourceHandleId.includes('source') ||
    sourceHandleId === (JQHandleIdPrefix.Bottom as string) ||
    sourceHandleId === (JQHandleIdPrefix.Flow as string) ||
    sourceHandleId === (JQHandleIdPrefix.Functions as string) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Logic}:`) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Param}:`) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Item}:`) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Field}:`) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.If}:`) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Then}:`) ||
    sourceHandleId === (JQHandleIdPrefix.Else as string) ||
    sourceHandleId.startsWith(JQHandleIdPrefix.OperatorLeft) ||
    sourceHandleId.startsWith(JQHandleIdPrefix.OperatorRight) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Root}:`) ||
    sourceHandleId === (JQHandleIdPrefix.Try as string) ||
    sourceHandleId === (JQHandleIdPrefix.Catch as string);
  const isTargetHandle =
    targetHandleId.includes('target') ||
    targetHandleId === (JQHandleIdPrefix.Top as string) ||
    targetHandleId === (JQHandleIdPrefix.OperatorLeft as string) ||
    targetHandleId === (JQHandleIdPrefix.OperatorRight as string);

  // Allow FunctionDecl's "logic" handle to connect to flow nodes + Comment
  if (
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Logic}:`) &&
    sourceNodeType === JQNodeType.FunctionDecl
  ) {
    return [...PIPELINE_NODE_TYPES, JQNodeType.Comment].includes(targetNodeType);
  }

  // Param handles can connect to Value, Condition, TryCatch, or FunctionCall nodes (NOT Comment)
  if (sourceHandleId.startsWith(`${JQHandleIdPrefix.Param}:`)) {
    return [
      JQNodeType.Value,
      JQNodeType.Condition,
      JQNodeType.TryCatch,
      JQNodeType.FunctionCall,
    ].includes(targetNodeType);
  }

  // Item / field / root handles can connect to Value or FunctionCall nodes (NOT Comment)
  if (
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Item}:`) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Field}:`) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Root}:`)
  ) {
    return [JQNodeType.Value, JQNodeType.FunctionCall].includes(targetNodeType);
  }

  // An operator's target handles take an operand node over one of that operand's
  // own operator handles. The jq generator reads an operand's nesting order off
  // the list of its operator-handle edges, so an edge arriving from any other
  // handle is missing from that list and the graph stops converting — which no
  // connection drawn on the canvas may do.
  if (
    targetHandleId === (JQHandleIdPrefix.OperatorLeft as string) ||
    targetHandleId === (JQHandleIdPrefix.OperatorRight as string)
  ) {
    return (
      (sourceHandleId.startsWith(JQHandleIdPrefix.OperatorLeft) ||
        sourceHandleId.startsWith(JQHandleIdPrefix.OperatorRight)) &&
      OPERAND_NODE_TYPES.includes(sourceNodeType)
    );
  }

  // Value's operator handles can only connect to Operator nodes
  if (
    sourceHandleId.startsWith(JQHandleIdPrefix.OperatorLeft) ||
    sourceHandleId.startsWith(JQHandleIdPrefix.OperatorRight)
  ) {
    return targetNodeType === JQNodeType.Operator;
  }

  // Condition side handles connect to Value, FunctionCall, Condition, TryCatch (NOT Comment)
  if (
    sourceHandleId.startsWith(`${JQHandleIdPrefix.If}:`) ||
    sourceHandleId.startsWith(`${JQHandleIdPrefix.Then}:`) ||
    sourceHandleId === (JQHandleIdPrefix.Else as string)
  ) {
    return [
      JQNodeType.Value,
      JQNodeType.FunctionCall,
      JQNodeType.Condition,
      JQNodeType.TryCatch,
    ].includes(targetNodeType);
  }

  // TryCatch side handles connect to Value, FunctionCall, Condition, TryCatch (NOT Comment)
  if (
    sourceHandleId === (JQHandleIdPrefix.Try as string) ||
    sourceHandleId === (JQHandleIdPrefix.Catch as string)
  ) {
    return [
      JQNodeType.Value,
      JQNodeType.FunctionCall,
      JQNodeType.Condition,
      JQNodeType.TryCatch,
    ].includes(targetNodeType);
  }

  if (!isSourceHandle || !isTargetHandle) {
    return false;
  }

  if (targetNodeType === JQNodeType.Start) {
    return false;
  }

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
