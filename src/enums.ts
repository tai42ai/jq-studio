export enum JQNodeType {
  Start = 'jqStart',
  FunctionDecl = 'jqFunctionDecl',
  FunctionCall = 'jqFunctionCall',
  Value = 'jqValue',
  Operator = 'jqOperator',
  Condition = 'jqCondition',
  TryCatch = 'jqTryCatch',
  Comment = 'jqComment',
}

/** Node types that can be operands in operator chains. */
export const OPERAND_NODE_TYPES: JQNodeType[] = [JQNodeType.Value, JQNodeType.FunctionCall];

export enum ValueType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Array = 'array',
  Object = 'object',
  Path = 'path',
  Null = 'null',
}

export const VALID_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** jq language reserved keywords — cannot be used as function or parameter names. */
export const JQ_RESERVED_KEYWORDS: string[] = [
  'def',
  'as',
  'if',
  'then',
  'elif',
  'else',
  'end',
  'and',
  'or',
  'not',
  'try',
  'catch',
  'reduce',
  'foreach',
  'limit',
  'first',
  'last',
  'label',
  'break',
  'import',
  'include',
  'module',
];

export enum JQHandleIdPrefix {
  Top = 'top---',
  Bottom = 'bottom---',
  Inner = 'inner---',
  Flow = 'flow---',
  Functions = 'functions---',
  Logic = 'logic---',
  Param = 'param---',
  Item = 'item---',
  Field = 'field---',
  If = 'if---',
  Then = 'then---',
  Else = 'else---',
  OperatorLeft = 'operator-left---',
  OperatorRight = 'operator-right---',
  Root = 'root---',
  Try = 'try---',
  Catch = 'catch---',
}
