/**
 * @fileoverview Main entry point for JQ to Flow converter.
 *
 * Converts jq expression strings to visual JQ flow graphs with perfect auto-layout.
 */

import { type JQNode, type JQEdge } from '../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../enums';
import { type ConversionContext } from './types';
import { MAX_EXPRESSION_LENGTH } from './constants';
import { initializeBuiltInFunctions } from './utils';
import { parseJQExpression } from './parser';
import { extractFunctionDeclarations } from './parser/function-declaration-extractor';
import { convertASTNode } from './node-creators/ast-converter';
import { generateNodeId, createEdge } from './node-creators/utils';
import { applyAutoLayout } from './layout';

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
 * @returns Object containing nodes and edges arrays
 */
export function convertJQToFlow(jqExpression: string): { nodes: JQNode[]; edges: JQEdge[] } {
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

  // Process function declarations
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
