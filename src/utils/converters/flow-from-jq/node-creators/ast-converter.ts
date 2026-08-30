/**
 * @fileoverview Main AST to visual node converter dispatcher.
 *
 * This module provides the main conversion function that dispatches AST nodes
 * to their appropriate creator functions.
 */

import { ValueType, JQNodeType, JQHandleIdPrefix } from '../../../../enums';
import { type JQNode } from '../../../../types';
import { type ConversionContext, type ASTNode } from '../types';
import { createValueNode } from './value-creator';
import { createFunctionCallNode } from './function-creator';
import { createOperatorNode } from './operator-creator';
import { createConditionalNode } from './conditional-creator';
import { createTryCatchNode } from './trycatch-creator';
import { createArrayNode, createObjectNode } from './array-object-creator';
import { generateNodeId, createEdge } from './utils';
import { flattenPipeStages } from '../pipe-utils';
import { type ASTPipeNode } from '../types';

/**
 * Converts an AST node to a visual flow node.
 *
 * This is the main dispatch function that handles all AST node types.
 *
 * @param astNode - The AST node to convert
 * @param context - Conversion context
 * @returns The created visual node ID
 * @throws {Error} If the AST node type is unsupported
 */
export function convertASTNode(astNode: ASTNode, context: ConversionContext): string {
  switch (astNode.type) {
    case 'Identity':
      return createValueNode('.', ValueType.Path, context);

    case 'String':
      return createValueNode(astNode.value, ValueType.String, context);

    case 'Number':
      return createValueNode(astNode.value, ValueType.Number, context);

    case 'Boolean':
      return createValueNode(astNode.value, ValueType.Boolean, context);

    case 'Null':
      return createValueNode(null, ValueType.Null, context);

    case 'Path':
      return createValueNode(astNode.value, ValueType.Path, context);

    case 'Variable': {
      // Variable reference — create a new Value node with the variable path.
      // Each reference gets its own node (no multiple connections to the original).
      if (!context.variableMap.has(astNode.name)) {
        throw new Error(`Reference to undefined variable: $${astNode.name}`);
      }
      return createValueNode(`$${astNode.name}`, ValueType.Path, context);
    }

    case 'FunctionCall':
      return createFunctionCallNode(astNode.name, astNode.args, context, convertASTNode);

    case 'Assignment': {
      // Create the expression node, then register it as a variable
      const exprNodeId = convertASTNode(astNode.value, context);
      context.variableMap.set(astNode.variable, exprNodeId);
      // Preserve the original variable name for round-trip fidelity
      const node = context.nodes.find((n) => n.id === exprNodeId);
      if (node) {
        node.data.name = astNode.variable;
      }
      return exprNodeId;
    }

    case 'Pipe':
      return convertPipeChain(astNode, context);

    case 'Array':
      return createArrayNode(astNode.elements, context, convertASTNode);

    case 'Object':
      return createObjectNode(astNode.fields, context, convertASTNode);

    case 'Operator':
      return createOperatorNode(
        astNode.operator,
        astNode.left,
        astNode.right,
        context,
        convertASTNode,
      );

    case 'Conditional':
      return createConditionalNode(astNode.branches, astNode.elseBranch, context, convertASTNode);

    case 'TryCatch':
      return createTryCatchNode(astNode.tryExpr, astNode.catchExpr, context, convertASTNode);

    case 'Comment': {
      const commentNodeId = generateNodeId(context);
      const commentNode: JQNode = {
        id: commentNodeId,
        type: JQNodeType.Comment,
        position: { x: 0, y: 0 },
        data: {
          type: JQNodeType.Comment,
          text: astNode.text,
        },
      };
      context.nodes.push(commentNode);
      return commentNodeId;
    }

    default: {
      // TypeScript exhaustiveness check - ensures all cases are handled
      const _exhaustive: never = astNode;
      throw new Error(`Unsupported AST node type: ${(_exhaustive as ASTNode).type}`);
    }
  }
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
      if (next?.type === 'Variable' && next.name === stage.variable) {
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
