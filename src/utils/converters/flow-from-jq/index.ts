/**
 * @fileoverview Main entry point for JQ to Flow converter.
 *
 * Converts jq expression strings to visual JQ flow graphs with perfect auto-layout.
 */

import { JQHandleIdPrefix, JQNodeType } from '../../../enums';
import { type JQEdge, type JQNode } from '../../../types';
import { MAX_EXPRESSION_LENGTH } from './constants';
import { applyAutoLayout } from './layout';
import { convertASTNode } from './node-creators/ast-converter';
import { createEdge, generateNodeId } from './node-creators/utils';
import { parseJQExpression } from './parser';
import {
  extractFunctionDeclarations,
  type FunctionDeclaration,
} from './parser/function-declaration-extractor';
import { type ConversionContext } from './types';
import { initializeBuiltInFunctions } from './utils';

/**
 * Creates a FunctionDecl node for each declaration, wires it to the Start node's
 * functions handle, registers it so FunctionCall nodes can reference it, and
 * converts its body onto the declaration's logic handle.
 *
 * @param declarations - The extracted declarations, in source order
 * @param startNodeId - The Start node's id
 * @param context - Conversion context, mutated in place
 */
function processFunctionDeclarations(
  declarations: FunctionDeclaration[],
  startNodeId: string,
  context: ConversionContext,
): void {
  for (const decl of declarations) {
    const funcDeclNodeId = generateNodeId(context);
    const funcDeclNode: JQNode = {
      id: funcDeclNodeId,
      type: JQNodeType.FunctionDecl,
      position: { x: 0, y: 0 },
      data: {
        type: JQNodeType.FunctionDecl,
        name: decl.name,
        parameters: decl.params,
      },
    };
    context.nodes.push(funcDeclNode);

    // Connect Start.Functions -> FunctionDecl.Top
    createEdge(
      startNodeId,
      funcDeclNodeId,
      JQHandleIdPrefix.Functions,
      JQHandleIdPrefix.Top,
      context,
    );

    // Register function in context so FunctionCall nodes can reference it
    context.functionDefinitions.set(decl.name, { params: decl.params, nodeId: funcDeclNodeId });

    // Parse and convert the body expression
    const bodyAst = parseJQExpression(decl.body);
    if (bodyAst.type !== 'Identity') {
      const bodyEntryNodeId = convertASTNode(bodyAst, context);
      // Connect FunctionDecl.Logic -> bodyEntry.Top
      createEdge(
        funcDeclNodeId,
        bodyEntryNodeId,
        `${JQHandleIdPrefix.Logic}:${funcDeclNodeId}:expression`,
        JQHandleIdPrefix.Top,
        context,
      );
    }
  }
}

/**
 * Converts a jq expression string to a visual JQ flow graph.
 *
 * This function performs the following steps:
 * 1. Extracts function declarations
 * 2. Parses the jq expression into an AST — `#` comments included, each one a
 *    stage of the chain it is written in
 * 3. Creates a Start node
 * 4. Converts AST nodes to visual nodes
 * 5. Applies perfect auto-layout algorithm
 *
 * @param jqExpression - The jq expression string to convert
 * @param declaredVariables - Names (without `$`) of variables the host binds
 *   beside `.`; each is accepted as a valid path root even though nothing in the
 *   expression assigns it.
 * @returns Object containing nodes and edges arrays
 */
export function convertJQToFlow(
  jqExpression: string,
  declaredVariables: readonly string[] = [],
): { nodes: JQNode[]; edges: JQEdge[] } {
  // Validate input
  if (!jqExpression.trim()) {
    throw new Error('JQ expression cannot be empty');
  }
  if (jqExpression.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(
      `Expression exceeds maximum length of ${String(MAX_EXPRESSION_LENGTH)} characters`,
    );
  }

  // Initialize context
  const context: ConversionContext = {
    nodes: [],
    edges: [],
    nodeIdCounter: 0,
    edgeIdCounter: 0,
    variableMap: new Map(),
    declaredVariables: new Set(declaredVariables),
    functionDefinitions: new Map(),
    builtInFunctions: new Map(),
    operatorResultMap: new Map(),
  };

  // Build built-in function registry
  initializeBuiltInFunctions(context);

  // Create Start node
  const startNodeId = generateNodeId(context);
  const startNode: JQNode = {
    id: startNodeId,
    type: JQNodeType.Start,
    position: { x: 0, y: 0 },
    data: {
      type: JQNodeType.Start,
      name: 'start',
    },
  };
  context.nodes.push(startNode);

  // Extract function declarations before parsing the main expression
  const { declarations, mainExpression } = extractFunctionDeclarations(jqExpression);

  processFunctionDeclarations(declarations, startNodeId, context);

  // Parse main expression
  const ast = parseJQExpression(mainExpression);

  // Special case: identity expression should only have Start node (plus any function decls)
  if (ast.type === 'Identity') {
    applyAutoLayout(context.nodes, context.edges);

    return {
      nodes: context.nodes,
      edges: context.edges,
    };
  }

  // Convert AST to nodes
  const flowEntryNodeId = convertASTNode(ast, context);

  // Connect Start to flow entry
  createEdge(startNodeId, flowEntryNodeId, JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top, context);

  // Apply auto-layout with all fixes
  applyAutoLayout(context.nodes, context.edges);

  return {
    nodes: context.nodes,
    edges: context.edges,
  };
}
