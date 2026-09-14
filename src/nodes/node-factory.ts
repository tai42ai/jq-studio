/**
 * The palette's node vocabulary: the short type label used to number fresh
 * nodes, and the default data a newly-placed node of each kind starts with.
 */
import { JQNodeType, ValueType } from '../enums';
import type { JQNodeData } from '../types';

export const NODE_TYPE_LABELS: Record<JQNodeType, string> = {
  [JQNodeType.Start]: 'start',
  [JQNodeType.FunctionDecl]: 'func_decl',
  [JQNodeType.FunctionCall]: 'func_call',
  [JQNodeType.Value]: 'value',
  [JQNodeType.Operator]: 'operator',
  [JQNodeType.Condition]: 'condition',
  [JQNodeType.TryCatch]: 'try_catch',
  [JQNodeType.Comment]: 'comment',
};

/** The default data a freshly-placed node of `type` carries. */
export const createDefaultNodeData = (type: JQNodeType, name?: string): JQNodeData => {
  switch (type) {
    case JQNodeType.Start:
      return { type: JQNodeType.Start, name };
    case JQNodeType.FunctionDecl:
      return { type: JQNodeType.FunctionDecl, name, parameters: [], bodyExpression: '.' };
    case JQNodeType.FunctionCall:
      return { type: JQNodeType.FunctionCall, callType: 'builtin', name };
    case JQNodeType.Operator:
      return { type: JQNodeType.Operator, name, operator: '+' };
    case JQNodeType.Value:
      return { type: JQNodeType.Value, name, valueType: ValueType.String, value: '' };
    case JQNodeType.Condition:
      return { type: JQNodeType.Condition, name, branches: [{ id: crypto.randomUUID() }] };
    case JQNodeType.TryCatch:
      return { type: JQNodeType.TryCatch, name };
    case JQNodeType.Comment:
      return { type: JQNodeType.Comment, text: '' };
  }
};
