/**
 * @fileoverview Type definitions for JQ to Flow converter.
 */

import { type JQNode, type JQEdge } from '../../../types';
import { type FunctionDef } from '../../function-registry';

/**
 * Conversion context maintaining state during JQ to UI conversion.
 */
export interface ConversionContext {
  /** All generated nodes */
  nodes: JQNode[];

  /** All generated edges */
  edges: JQEdge[];

  /** Counter for generating unique node IDs */
  nodeIdCounter: number;

  /** Counter for generating unique edge IDs */
  edgeIdCounter: number;

  /** Map of variable names to node IDs for reference resolution */
  variableMap: Map<string, string>;

  /** Map of function names to their definitions (for custom functions) */
  functionDefinitions: Map<string, { params: string[]; nodeId: string }>;

  /** Registry of built-in functions for lookup */
  builtInFunctions: Map<string, FunctionDef>;

  /** Maps operator chain entry (leftNodeId) to inner operator's right value node */
  operatorResultMap: Map<string, string>;
}

/**
 * AST node types for jq expression parsing.
 * Uses discriminated union for type safety.
 */
export type ASTNode =
  | ASTIdentityNode
  | ASTStringNode
  | ASTNumberNode
  | ASTBooleanNode
  | ASTNullNode
  | ASTPathNode
  | ASTVariableNode
  | ASTFunctionCallNode
  | ASTAssignmentNode
  | ASTPipeNode
  | ASTArrayNode
  | ASTObjectNode
  | ASTOperatorNode
  | ASTConditionalNode
  | ASTTryCatchNode
  | ASTCommentNode;

export interface ASTIdentityNode {
  type: 'Identity';
  value: '.';
}

export interface ASTStringNode {
  type: 'String';
  value: string;
}

export interface ASTNumberNode {
  type: 'Number';
  value: number;
}

export interface ASTBooleanNode {
  type: 'Boolean';
  value: boolean;
}

export interface ASTNullNode {
  type: 'Null';
  value: null;
}

export interface ASTPathNode {
  type: 'Path';
  value: string;
}

export interface ASTVariableNode {
  type: 'Variable';
  name: string;
  /**
   * Postfix path applied to the reference (`.field`, `["key"]`, …), kept apart
   * from the name so scope checks see the bare variable — `$a.b` reads a field
   * OF `$a`, not a variable named `a.b`.
   */
  path?: string;
}

export interface ASTFunctionCallNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

export interface ASTAssignmentNode {
  type: 'Assignment';
  value: ASTNode;
  variable: string;
}

export interface ASTPipeNode {
  type: 'Pipe';
  left: ASTNode;
  right: ASTNode;
}

export interface ASTArrayNode {
  type: 'Array';
  elements: ASTNode[];
}

export interface ASTObjectNode {
  type: 'Object';
  fields: { key: string; value: ASTNode }[];
}

export interface ASTOperatorNode {
  type: 'Operator';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface ASTConditionalNode {
  type: 'Conditional';
  branches: { condition: ASTNode; then: ASTNode }[];
  elseBranch?: ASTNode;
}

export interface ASTTryCatchNode {
  type: 'TryCatch';
  tryExpr: ASTNode;
  catchExpr?: ASTNode;
}

/**
 * A `#` comment as a stage of the pipe chain it was written in.
 *
 * The text carries no leading `#` and joins the lines of a multiline comment
 * with `\n`, matching a Comment node's own text.
 */
export interface ASTCommentNode {
  type: 'Comment';
  text: string;
}
