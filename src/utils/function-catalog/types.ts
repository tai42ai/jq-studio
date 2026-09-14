/**
 * @fileoverview Shared shapes for the jq built-in function catalog.
 */

export interface FunctionParam {
  name: string;
  description: string;
  /** A parameter jq lets you omit — the builtin has a valid ZERO-arg overload
   *  (e.g. `first`/`last`, which without a filter take the first/last value of
   *  the input stream). An omitted optional parameter is not a validation error,
   *  and the serializer emits the bare call (`first`, not `first(.)`). */
  optional?: boolean;
}

export interface FunctionDef {
  id: string;
  name: string;
  description: string;
  params: FunctionParam[];
}

export interface FunctionCategory {
  id: string;
  label: string;
  description: string;
  functions: FunctionDef[];
}
