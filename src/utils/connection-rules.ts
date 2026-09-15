/**
 * @fileoverview The shared connection rule tables for the jq flow graph: how a
 * handle id classifies, which target node types each handle kind accepts, and
 * the per-node-type drag targets/sources. Both connection readers consult these
 * so the "what may connect to what" contract lives in one place.
 */

import { JQHandleIdPrefix, JQNodeType } from '../enums';

/** Pipeline node types that can appear in the main flow chain (bottom→top connections). */
export const PIPELINE_NODE_TYPES: JQNodeType[] = [
  JQNodeType.FunctionCall,
  JQNodeType.Value,
  JQNodeType.Condition,
  JQNodeType.TryCatch,
];

const startsWithAny = (value: string, prefixes: string[]): boolean =>
  prefixes.some((prefix) => value.startsWith(prefix));

/**
 * The handle kinds that carry a connection rule. `other` covers the plain pipe
 * handles (top/bottom/inner) and anything unrecognised, which fall through to
 * the per-node-type drag tables rather than a handle-specific rule.
 */
export type HandleKind =
  | 'param'
  | 'itemFieldRoot'
  | 'conditionBranch'
  | 'tryCatch'
  | 'operatorOperand'
  | 'logic'
  | 'flow'
  | 'functions'
  | 'other';

/** Classifies a handle id into the kind that drives its connection rule. */
export const classifyHandle = (handleId: string | null): HandleKind => {
  if (!handleId) return 'other';
  if (handleId.startsWith(`${JQHandleIdPrefix.Param}:`)) return 'param';
  if (
    startsWithAny(handleId, [
      `${JQHandleIdPrefix.Item}:`,
      `${JQHandleIdPrefix.Field}:`,
      `${JQHandleIdPrefix.Root}:`,
    ])
  ) {
    return 'itemFieldRoot';
  }
  if (
    startsWithAny(handleId, [`${JQHandleIdPrefix.If}:`, `${JQHandleIdPrefix.Then}:`]) ||
    handleId === (JQHandleIdPrefix.Else as string)
  ) {
    return 'conditionBranch';
  }
  if ([JQHandleIdPrefix.Try, JQHandleIdPrefix.Catch].includes(handleId as JQHandleIdPrefix)) {
    return 'tryCatch';
  }
  if (startsWithAny(handleId, [JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight])) {
    return 'operatorOperand';
  }
  if (handleId.startsWith(`${JQHandleIdPrefix.Logic}:`)) return 'logic';
  if (handleId === (JQHandleIdPrefix.Flow as string)) return 'flow';
  if (handleId === (JQHandleIdPrefix.Functions as string)) return 'functions';
  return 'other';
};

/** A handle id that is an operator node's own `a`/`b` operand slot (exact, unsuffixed). */
export const isOperatorSlotHandle = (handleId: string): boolean =>
  handleId === (JQHandleIdPrefix.OperatorLeft as string) ||
  handleId === (JQHandleIdPrefix.OperatorRight as string);

/**
 * The target node types a source handle accepts, keyed by handle kind. Only the
 * kinds whose rule is fixed by the handle alone appear here; operator, logic,
 * flow, and functions handles fold in extra node-type/handle-type conditions and
 * are resolved by the connection reader.
 */
export const HANDLE_TARGET_RULES: Partial<Record<HandleKind, JQNodeType[]>> = {
  param: [JQNodeType.Value, JQNodeType.Condition, JQNodeType.TryCatch, JQNodeType.FunctionCall],
  itemFieldRoot: [JQNodeType.Value, JQNodeType.FunctionCall],
  conditionBranch: [
    JQNodeType.Value,
    JQNodeType.FunctionCall,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
  ],
  tryCatch: [JQNodeType.Value, JQNodeType.FunctionCall, JQNodeType.Condition, JQNodeType.TryCatch],
};

/** Target node types reachable when dragging from a node's SOURCE (bottom) handle. */
export const SOURCE_DRAG_TARGETS: Partial<Record<JQNodeType, JQNodeType[]>> = {
  [JQNodeType.Start]: [
    JQNodeType.FunctionCall,
    JQNodeType.Value,
    JQNodeType.FunctionDecl,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
    JQNodeType.Comment,
  ],
  [JQNodeType.FunctionDecl]: [...PIPELINE_NODE_TYPES, JQNodeType.Comment],
  [JQNodeType.FunctionCall]: [...PIPELINE_NODE_TYPES, JQNodeType.Comment],
  [JQNodeType.Value]: [
    JQNodeType.FunctionCall,
    JQNodeType.Value,
    JQNodeType.Operator,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
    JQNodeType.Comment,
  ],
  [JQNodeType.Operator]: [
    JQNodeType.Value,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
    JQNodeType.Comment,
  ],
  [JQNodeType.Condition]: [...PIPELINE_NODE_TYPES, JQNodeType.Comment],
  [JQNodeType.TryCatch]: [...PIPELINE_NODE_TYPES, JQNodeType.Comment],
  // Comment bottom can connect to pipeline nodes but NOT to other Comments.
  [JQNodeType.Comment]: [...PIPELINE_NODE_TYPES],
};

/** Source node types accepted when dragging onto a node's TARGET (top) handle. */
export const TARGET_DRAG_SOURCES: Partial<Record<JQNodeType, JQNodeType[]>> = {
  [JQNodeType.Start]: [],
  [JQNodeType.FunctionDecl]: [JQNodeType.Start],
  [JQNodeType.FunctionCall]: [
    JQNodeType.Start,
    JQNodeType.FunctionDecl,
    JQNodeType.FunctionCall,
    JQNodeType.Value,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
    JQNodeType.Comment,
  ],
  [JQNodeType.Value]: [
    JQNodeType.Start,
    JQNodeType.FunctionDecl,
    JQNodeType.FunctionCall,
    JQNodeType.Value,
    JQNodeType.Operator,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
    JQNodeType.Comment,
  ],
  [JQNodeType.Operator]: [
    JQNodeType.Start,
    JQNodeType.FunctionDecl,
    JQNodeType.FunctionCall,
    JQNodeType.Value,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
    JQNodeType.Comment,
  ],
  [JQNodeType.Condition]: [
    JQNodeType.Start,
    JQNodeType.FunctionDecl,
    JQNodeType.FunctionCall,
    JQNodeType.Value,
    JQNodeType.Operator,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
    JQNodeType.Comment,
  ],
  [JQNodeType.TryCatch]: [
    JQNodeType.Start,
    JQNodeType.FunctionDecl,
    JQNodeType.FunctionCall,
    JQNodeType.Value,
    JQNodeType.Operator,
    JQNodeType.Condition,
    JQNodeType.TryCatch,
    JQNodeType.Comment,
  ],
  // Comment top can receive from pipeline nodes and Start, but NOT from other Comments.
  [JQNodeType.Comment]: [JQNodeType.Start, JQNodeType.FunctionDecl, ...PIPELINE_NODE_TYPES],
};

/** Whether a handle id reads as a SOURCE endpoint of a would-be connection. */
export const isSourceHandleId = (handleId: string): boolean =>
  handleId.includes('source') ||
  [
    JQHandleIdPrefix.Bottom,
    JQHandleIdPrefix.Flow,
    JQHandleIdPrefix.Functions,
    JQHandleIdPrefix.Else,
    JQHandleIdPrefix.Try,
    JQHandleIdPrefix.Catch,
  ].includes(handleId as JQHandleIdPrefix) ||
  startsWithAny(handleId, [
    `${JQHandleIdPrefix.Logic}:`,
    `${JQHandleIdPrefix.Param}:`,
    `${JQHandleIdPrefix.Item}:`,
    `${JQHandleIdPrefix.Field}:`,
    `${JQHandleIdPrefix.If}:`,
    `${JQHandleIdPrefix.Then}:`,
    JQHandleIdPrefix.OperatorLeft,
    JQHandleIdPrefix.OperatorRight,
    `${JQHandleIdPrefix.Root}:`,
  ]);

/** Whether a handle id reads as a TARGET endpoint of a would-be connection. */
export const isTargetHandleId = (handleId: string): boolean =>
  handleId.includes('target') ||
  [JQHandleIdPrefix.Top, JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorRight].includes(
    handleId as JQHandleIdPrefix,
  );

/**
 * Whether a source handle may fan out to more than one wire. Every jq source
 * handle is single-output except the Start node's `functions` port, which grants
 * every declared function.
 */
export const allowsMultipleFromSource = (
  sourceNodeType: JQNodeType,
  sourceHandleId: string | null,
): boolean =>
  sourceNodeType === JQNodeType.Start && sourceHandleId === (JQHandleIdPrefix.Functions as string);
