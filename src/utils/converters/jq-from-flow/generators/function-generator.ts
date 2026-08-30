/**
 * @fileoverview Function call and declaration expression generators.
 */

import { type JQNode, type JQFunctionCallData, type JQEdge } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix, OPERAND_NODE_TYPES } from '../../../../enums';
import { type ConversionContext } from '../types';
import { validateVariableName, edgeTargetNode } from '../utils/validators';
import { classifyEdge } from '../utils/edge-classifier';
import { shouldCreateVariable } from '../utils/variable-checker';
import { findOutermostOperator, findPipeChainEnd } from '../utils/operator-resolver';
import { getFunctionDefById } from '../../../function-registry';
import { isMultiline } from '../utils/formatter';
import {
  type ExpressionPart,
  type OpenBinding,
  commentParts,
  joinExpressionParts,
  pushChainPart,
  closeOpenBinding,
  nextChainNode,
} from '../expression-builder';
import { buildBranchChainExpression, type NodeExpressionFn } from './branch-chain-builder';

/**
 * Determines if an operand node in a param chain should create a variable.
 *
 * In param chains, operand nodes (Value, FunctionCall) with names create variables EXCEPT:
 * 1. When the node has no name (optional — just passes expression through)
 * 2. When the node is a child of another node (connected via Item/Field/Root handles)
 * 3. When the node is part of an operator chain (no TOP connection, has operator connections)
 */
function shouldParamNodeCreateVariable(node: JQNode, context: ConversionContext): boolean {
  if (!OPERAND_NODE_TYPES.includes(node.data.type)) return false;

  // No name → no variable
  if (!node.data.name) return false;

  // Exception 1: child of another Value node (connected via Item/Field/Root)
  const incomingEdges = context.edgesByTarget.get(node.id) ?? [];
  const isValueChild = incomingEdges.some(
    (e) =>
      (e.sourceHandle ?? '').startsWith(`${JQHandleIdPrefix.Item}:`) ||
      (e.sourceHandle ?? '').startsWith(`${JQHandleIdPrefix.Field}:`) ||
      (e.sourceHandle ?? '').startsWith(`${JQHandleIdPrefix.Root}:`),
  );
  if (isValueChild) return false;

  // Exception 2: operator chain node (no TOP connection, has operator connections)
  const hasTopConnection = incomingEdges.some((e) =>
    e.targetHandle?.startsWith(JQHandleIdPrefix.Top),
  );
  const outgoingEdges = context.edgesBySource.get(node.id) ?? [];
  const hasOperatorConnection = outgoingEdges.some(
    (e) =>
      (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
      (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
  );
  if (!hasTopConnection && hasOperatorConnection) return false;

  return true;
}

/**
 * Builds a piped expression chain starting from a parameter entry node.
 * Follows bottom-handle edges to traverse the full sub-flow chain.
 *
 * For each node in the chain:
 * - A Comment node contributes one comment part per non-blank line of its text
 *   and never calls nodeExpressionFn.
 * - A node with operator-handle edges contributes the outermost operator's
 *   expression instead of its own, and the next bottom-handle hop is taken from
 *   `findPipeChainEnd` instead of from the node directly — that walks past the
 *   pipe-chain nodes feeding the operands, and returns the node itself when the
 *   node is named or when its bottom edge comes after its operator edges.
 * - A node that creates a variable — by the param-chain operand rules or the
 *   standard rules — contributes `<expr> as $name`, with `| $name` appended when
 *   `pipeAfterDeclare` is set or when the chain ends on the binding.
 * - Every other node contributes exactly what nodeExpressionFn returns for it.
 *
 * Parts are joined inline: expressions separated by ` | `, comment parts rendered
 * as `# text` without a pipe. A `# text` part runs to the end of its line, so the
 * part following one continues on the next line instead of inline, and a chain
 * ending on a comment is terminated with a newline so the parameter separator or
 * declaration terminator that follows survives.
 *
 * @throws {Error} If the chain consists of Comment nodes only — a parameter and a
 *   function body each need an expression, and comments alone cannot supply one
 * @throws {Error} If the chain loops back on a node it already passed through
 */
function buildParamChainExpression(
  entryNode: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent: number,
): string {
  const parts: ExpressionPart[] = [];
  const visited = new Set<string>([entryNode.id]);
  let openBinding: OpenBinding | null = null;
  let currentNode: JQNode | null = entryNode;

  while (currentNode) {
    // Comment nodes emit `# text` lines
    if (currentNode.data.type === JQNodeType.Comment) {
      parts.push(...commentParts(currentNode.data.text));
      const outgoingEdges: JQEdge[] = context.edgesBySource.get(currentNode.id) ?? [];
      const nextEdge: JQEdge | undefined = outgoingEdges.find(
        (e) => classifyEdge(e).isBottomHandle,
      );
      currentNode = nextChainNode(nextEdge, context, visited);
      continue;
    }

    const outgoingEdges = context.edgesBySource.get(currentNode.id) ?? [];

    // Detect operator chain — find outermost operator by traversing shared operand edges
    const hasOperatorEdge = outgoingEdges.some(
      (e) =>
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
    );

    let nodeExpr: string;
    let pipeChainEndNode = currentNode;
    if (hasOperatorEdge) {
      const operatorNode = findOutermostOperator(currentNode.id, context);
      nodeExpr = nodeExpressionFn(operatorNode, context, indent);
      // Skip past pipe chain nodes consumed by operator operands
      pipeChainEndNode = findPipeChainEnd(currentNode, context);
    } else {
      nodeExpr = nodeExpressionFn(currentNode, context, indent);
    }

    // Value nodes in param chains create variables by default (with exceptions)
    // Other node types use the standard shouldCreateVariable rules
    const createVar =
      shouldParamNodeCreateVariable(currentNode, context) ||
      shouldCreateVariable(currentNode, context);

    openBinding = pushChainPart(parts, currentNode, nodeExpr, createVar);

    // Follow bottom handle from pipe chain end to next node
    const endOutgoing = context.edgesBySource.get(pipeChainEndNode.id) ?? [];
    const nextEdge = endOutgoing.find((e) => classifyEdge(e).isBottomHandle);
    currentNode = nextChainNode(nextEdge, context, visited);
  }

  closeOpenBinding(openBinding);

  return joinExpressionParts(parts, entryNode.id, true);
}

/**
 * Reads the argument position a parameter edge carries in its
 * `param---:<index>` source handle.
 *
 * The call's arguments are ordered by that index alone; a handle without a
 * whole number after the colon would leave the order to edge storage — jq
 * compiles `range(9; 5)` where the flow draws `range(5; 9)`.
 *
 * @param node - The FunctionCall node the edge leaves
 * @param edge - The parameter edge
 * @returns The zero-based argument position
 * @throws {Error} If the handle carries no whole-number index
 */
function parameterIndex(node: JQNode, edge: JQEdge): number {
  const handle = edge.sourceHandle ?? '';
  const index = handle.split(':')[1] ?? '';
  if (!/^\d+$/.test(index)) {
    throw new Error(
      `FunctionCall node ${node.id} parameter edge ${edge.id} leaves handle "${handle}", ` +
        'which carries no argument position — reconnect the parameter from a ' +
        `"${JQHandleIdPrefix.Param}:<index>" handle`,
    );
  }
  return parseInt(index, 10);
}

/**
 * Generates a jq expression for a FunctionCall node.
 *
 * @param node - The FunctionCall node
 * @param context - Conversion context
 * @param nodeExpressionFn - Function to generate expressions for child nodes
 * @param indent - Current indentation level (default 0)
 * @returns The jq expression string
 * @throws {Error} If the function is not selected
 * @throws {Error} If a parameter handle carries no argument position
 */
export function generateFunctionCallExpression(
  node: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
  indent = 0,
): string {
  const data = node.data as JQFunctionCallData;

  if (!data.selectedFunction) {
    throw new Error(`FunctionCall node ${node.id} has no selected function`);
  }

  // Look up the function definition to get the actual function name
  // For built-in functions, selectedFunction is the ID (e.g., 'range_1')
  // For custom functions, selectedFunction is already the name
  const functionDef = getFunctionDefById(data.selectedFunction);
  const functionName = functionDef ? functionDef.name : data.selectedFunction;

  // Get parameter and root connections
  const outgoingEdges = context.edgesBySource.get(node.id) ?? [];

  // Check for root/input connection
  const rootEdge = outgoingEdges.find((e) =>
    (e.sourceHandle ?? '').startsWith(`${JQHandleIdPrefix.Root}:`),
  );

  // The root handle supplies the call's input, so the chain hanging off the root
  // node is piped into the call the same way every other side handle's chain is
  // walked — a node chained under the root contributes to the input, it is not
  // decoration to drop.
  let rootPrefix = '';
  if (rootEdge) {
    const rootNode = edgeTargetNode(context, rootEdge);
    rootPrefix = buildBranchChainExpression(rootNode, context, nodeExpressionFn, indent) + ' | ';
  }

  // Get parameter connections (param:0, param:1, etc.)
  // Every parameter edge's position is read before any sorting, so a handle carrying no
  // position is rejected even when the call has a single parameter and nothing is compared.
  const paramEdges = outgoingEdges
    .filter((e) => (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.Param))
    .map((e) => ({ edge: e, index: parameterIndex(node, e) }))
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.edge);

  if (paramEdges.length === 0) {
    // No parameters
    return `${rootPrefix}${functionName}`;
  }

  // Generate parameter expressions
  const params: string[] = [];
  for (const edge of paramEdges) {
    // Build the full chain expression starting from the parameter entry node
    const paramExpr = buildParamChainExpression(
      edgeTargetNode(context, edge),
      context,
      nodeExpressionFn,
      indent,
    );
    params.push(paramExpr);
  }

  // jq functions use semicolon to separate parameters
  return `${rootPrefix}${functionName}(${params.join('; ')})`;
}

/**
 * Generates jq function declarations from FunctionDecl nodes.
 *
 * Function declarations have the form: `def name(param1; param2): body;`
 *
 * @param startNode - The Start node
 * @param context - Conversion context
 * @param nodeExpressionFn - Function to generate expressions for child nodes
 * @returns Array of function declaration strings
 * @throws {Error} If a functions edge targets a node that is not a FunctionDecl
 */
export function generateFunctionDeclarations(
  startNode: JQNode,
  context: ConversionContext,
  nodeExpressionFn: NodeExpressionFn,
): string[] {
  const functionDecls: string[] = [];

  // Find all edges from Start node's "functions" handle
  const startEdges = context.edgesBySource.get(startNode.id) ?? [];
  const functionEdges = startEdges.filter((e) => e.sourceHandle === JQHandleIdPrefix.Functions);

  for (const edge of functionEdges) {
    const funcNode = edgeTargetNode(context, edge);
    // The functions handle only ever accepts a FunctionDecl, so an edge leaving it that
    // reaches another node type is a declaration the graph claims and cannot produce.
    // Skipping it would drop a `def` every call site still names.
    if (funcNode.data.type !== JQNodeType.FunctionDecl) {
      throw new Error(
        `Start node ${startNode.id} functions edge ${edge.id} targets ${funcNode.data.type} ` +
          `node ${edge.target} — the functions handle accepts FunctionDecl nodes only`,
      );
    }

    const funcData = funcNode.data;
    const funcName = funcData.name ?? '';
    const params = funcData.parameters ?? [];

    // Validate function name
    validateVariableName(funcName);

    // Validate parameter names
    for (const param of params) {
      validateVariableName(param);
    }

    // Register custom function
    context.customFunctions.set(funcName, params);

    // Find the logic body of the function
    const funcEdges = context.edgesBySource.get(funcNode.id) ?? [];
    const logicEdge = funcEdges.find((e) =>
      (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.Logic),
    );

    // A declaration with no logic edge is the identity function
    let bodyExpression = '.';
    if (logicEdge) {
      // Function bodies start at indent level 1
      // Use buildParamChainExpression to detect operator chains and pipe chains
      bodyExpression = buildParamChainExpression(
        edgeTargetNode(context, logicEdge),
        context,
        nodeExpressionFn,
        1,
      );
    }

    // Generate function declaration
    const paramSignature = params.length > 0 ? `(${params.join('; ')})` : '';
    const separator = isMultiline(bodyExpression) ? '\n  ' : ' ';
    const decl = `def ${funcName}${paramSignature}:${separator}${bodyExpression};`;

    functionDecls.push(decl);
  }

  return functionDecls;
}
