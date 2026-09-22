/**
 * @fileoverview Main AST to visual node converter dispatcher.
 *
 * This module provides the main conversion function that dispatches AST nodes
 * to their appropriate creator functions.
 */

import { JQHandleIdPrefix, ValueType } from '../../../../enums';
import { flattenPipeStages } from '../pipe-utils';
import { type ASTNode, type ConversionContext } from '../types';
import { type ASTPipeNode } from '../types';
import { createArrayNode, createObjectNode } from './array-object-creator';
import { createAssignmentNode } from './assignment-creator';
import { createCommentNode } from './comment-creator';
import { createConditionalNode } from './conditional-creator';
import { createFunctionCallNode } from './function-creator';
import { createOperatorNode } from './operator-creator';
import { createTryCatchNode } from './trycatch-creator';
import { createEdge } from './utils';
import { createValueNode } from './value-creator';

/** Builds the visual node for one AST node kind and returns its id. */
type AstNodeHandler<T extends ASTNode['type']> = (
  astNode: Extract<ASTNode, { type: T }>,
  context: ConversionContext,
) => string;

/** One handler per AST node kind — the compiler enforces the set is complete. */
type AstDispatch = { [T in ASTNode['type']]: AstNodeHandler<T> };

const dispatch: AstDispatch = {
  Identity: (_astNode, context) => createValueNode('.', ValueType.Path, context),
  String: (astNode, context) => createValueNode(astNode.value, ValueType.String, context),
  Number: (astNode, context) => createValueNode(astNode.value, ValueType.Number, context),
  Boolean: (astNode, context) => createValueNode(astNode.value, ValueType.Boolean, context),
  Null: (_astNode, context) => createValueNode(null, ValueType.Null, context),
  Path: (astNode, context) => createValueNode(astNode.value, ValueType.Path, context),
  // Variable reference — create a new Value node with the variable path. Each
  // reference gets its own node (no multiple connections to the original). A
  // reference resolves against the expression's own `as $name` bindings or a
  // variable the host declared beside `.`; anything else is undefined.
  Variable: (astNode, context) => {
    if (!context.variableMap.has(astNode.name) && !context.declaredVariables.has(astNode.name)) {
      throw new Error(`Reference to undefined variable: $${astNode.name}`);
    }
    return createValueNode(`$${astNode.name}${astNode.path ?? ''}`, ValueType.Path, context);
  },
  FunctionCall: (astNode, context) =>
    createFunctionCallNode(astNode.name, astNode.args, context, convertASTNode),
  Assignment: (astNode, context) => createAssignmentNode(astNode, context, convertASTNode),
  Pipe: (astNode, context) => convertPipeChain(astNode, context),
  Array: (astNode, context) => createArrayNode(astNode.elements, context, convertASTNode),
  Object: (astNode, context) => createObjectNode(astNode.fields, context, convertASTNode),
  Operator: (astNode, context) =>
    createOperatorNode(astNode.operator, astNode.left, astNode.right, context, convertASTNode),
  Conditional: (astNode, context) =>
    createConditionalNode(astNode.branches, astNode.elseBranch, context, convertASTNode),
  TryCatch: (astNode, context) =>
    createTryCatchNode(astNode.tryExpr, astNode.catchExpr, context, convertASTNode),
  Comment: (astNode, context) => createCommentNode(astNode, context),
};

/**
 * Converts an AST node to a visual flow node by dispatching on its kind.
 *
 * @param astNode - The AST node to convert
 * @param context - Conversion context
 * @returns The created visual node ID
 */
export function convertASTNode(astNode: ASTNode, context: ConversionContext): string {
  const handler = dispatch[astNode.type] as AstNodeHandler<ASTNode['type']>;
  return handler(astNode, context);
}

/**
 * Converts a pipe chain into a linear run of nodes and returns the chain's ENTRY
 * node id (so a parent connects to where the chain starts).
 *
 * The chain is flattened first, so a parenthesised sub-chain that surfaces as the
 * LEFT of an outer pipe — e.g. `(.a | .b) | .c`, which parses to
 * `Pipe(Pipe(.a, .b), .c)` — is walked stage by stage and every stage is wired to
 * the one before it. A left-nested read would instead connect the successor to
 * the sub-chain's ENTRY and silently drop the stages between (the corruption this
 * replaces: `(.a | .b) | length` losing `length`).
 *
 * `Identity` stages are passthroughs and create no node. The `expr as $var | $var`
 * shorthand is recognised across the flattened stages: the assignment node takes
 * `pipeAfterDeclare` and the redundant `$var` reference stage is elided.
 *
 * @param pipe - The pipe AST to convert
 * @param context - Conversion context
 * @returns The entry node id of the produced chain
 */
function convertPipeChain(pipe: ASTPipeNode, context: ConversionContext): string {
  const stages = flattenPipeStages(pipe);

  let entryId: string | null = null;
  let prevTail: string | null = null;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!stage || stage.type === 'Identity') {
      // A `.` stage is an implicit passthrough — no node, no edge.
      continue;
    }

    const nodeId = convertASTNode(stage, context);

    // `expr as $var | $var [| rest]`: mark the assignment as piping its own value
    // onward and skip the redundant `$var` reference stage that follows it.
    if (stage.type === 'Assignment') {
      const next = stages[i + 1];
      // A reference carrying a postfix path (`$v.field`) reads INTO the variable's
      // value, so it is a real stage — only the bare `$v` echo is redundant.
      if (next?.type === 'Variable' && next.name === stage.variable && next.path === undefined) {
        const node = context.nodes.find((n) => n.id === nodeId);
        if (node) node.data.pipeAfterDeclare = true;
        i++;
      }
    }

    entryId ??= nodeId;
    if (prevTail !== null && prevTail !== nodeId) {
      createEdge(prevTail, nodeId, JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top, context);
    }
    prevTail = nodeId;
  }

  // A chain of nothing but identities (`. | .`) collapses to a single identity node.
  return entryId ?? createValueNode('.', ValueType.Path, context);
}
