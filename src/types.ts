import { type Node, type Edge } from '@xyflow/react';
import { JQNodeType, ValueType } from './enums';
import type {
  JqInputShapeDescriptor,
  SampleInputProvider,
  ServerValidateHook,
} from './declaration';

export interface JQBaseNodeData {
  name?: string;
  label?: string;
  pipeAfterDeclare?: boolean;
  [key: string]: unknown;
}

export interface JQStartData extends JQBaseNodeData {
  type: JQNodeType.Start;
}

export interface JQFunctionDeclData extends JQBaseNodeData {
  type: JQNodeType.FunctionDecl;
  parameters?: string[];
  bodyExpression?: string;
}

export interface JQFunctionCallData extends JQBaseNodeData {
  type: JQNodeType.FunctionCall;
  callType: string;
  selectedFunction?: string;
}

export interface ValueArrayItem {
  id: string;
}

export interface ValueObjectField {
  id: string;
  name: string;
}

export interface JQValueData extends JQBaseNodeData {
  type: JQNodeType.Value;
  valueType: ValueType;
  value?: string | number | boolean | null;
  items?: ValueArrayItem[];
  fields?: ValueObjectField[];
  pathValue?: string;
  pathSegments?: PathSegment[];
}

export interface JQOperatorData extends JQBaseNodeData {
  type: JQNodeType.Operator;
  operator: string;
}

export interface JQConditionBranch {
  id: string;
}

export interface JQConditionData extends JQBaseNodeData {
  type: JQNodeType.Condition;
  branches: JQConditionBranch[];
}

export interface JQTryCatchData extends JQBaseNodeData {
  type: JQNodeType.TryCatch;
}

export interface JQCommentData extends JQBaseNodeData {
  type: JQNodeType.Comment;
  text: string;
}

export type PathSegmentType = 'root' | 'node_ref' | 'field' | 'index' | 'range';

export interface PathSegment {
  id: string;
  type: PathSegmentType;
  value: string;
  rangeEnd?: string;
}

export type JQNodeData =
  | JQStartData
  | JQFunctionDeclData
  | JQFunctionCallData
  | JQValueData
  | JQOperatorData
  | JQConditionData
  | JQTryCatchData
  | JQCommentData;

export type JQNode = Node<JQNodeData>;
export type JQEdge = Edge;

export interface TransformersProps {
  initialExpression?: string;
  onChange?: (expression: string) => void;
  onSave?: (expression: string) => void;
  onHasErrorsChange?: (hasErrors: boolean) => void;
  onHasLogicNodeChange?: (hasLogicNode: boolean) => void;
  onLogicLessSave?: () => void;
  /** What `.` is for this field — seeds the Test panel and the context chip. */
  shape?: JqInputShapeDescriptor;
  /** Live sample-input provider; takes precedence over `shape.sample` in the Test
   *  panel when it yields a defined value. */
  sampleInput?: SampleInputProvider;
  /** Pluggable server-validate hook surfaced in the Test panel. */
  serverValidate?: ServerValidateHook;
  /** Close the surrounding editor (the parse-failure fallback's primary action). */
  onRequestClose?: () => void;
  className?: string;
  readOnly?: boolean;
}

export interface TransformerConnectionState {
  isConnecting: boolean;
  sourceNodeId: string | null;
  sourceNodeType: JQNodeType | null;
  sourceHandleId: string | null;
  sourceHandleType: 'source' | 'target' | null;
  edges: Edge[];
}
