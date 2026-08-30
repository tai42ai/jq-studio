/**
 * @fileoverview Test helpers for converter tests.
 */

import { createRequire } from 'module';
import { dirname, join } from 'path';
import type { JqFactory, JqModule } from 'jq-web';
import {
  type JQNode,
  type JQEdge,
  type JQValueData,
  type JQFunctionCallData,
  type JQFunctionDeclData,
  type JQOperatorData,
  type JQConditionData,
  type JQTryCatchData,
  type JQCommentData,
  type PathSegment,
  type ValueArrayItem,
  type ValueObjectField,
  type JQConditionBranch,
} from '../../types';
import { JQNodeType, ValueType, JQHandleIdPrefix } from '../../enums';

/**
 * Options for creating value nodes.
 */
interface ValueNodeOptions {
  name?: string;
  x?: number;
  y?: number;
  pathSegments?: PathSegment[];
  items?: ValueArrayItem[];
  fields?: ValueObjectField[];
}

/**
 * Options for creating positioned nodes.
 */
interface PositionedNodeOptions {
  name?: string;
  x?: number;
  y?: number;
}

/**
 * Options for creating function call nodes.
 */
interface FunctionCallNodeOptions extends PositionedNodeOptions {
  callType?: string;
}

/**
 * Creates a Start node for testing.
 */
export function createStartNode(id = 'start'): JQNode {
  return {
    id,
    type: JQNodeType.Start,
    position: { x: 0, y: 0 },
    data: {
      type: JQNodeType.Start,
      name: 'start',
    },
  };
}

/**
 * Creates a Value node for testing.
 */
export function createValueNode(
  id: string,
  valueType: ValueType,
  value: string | number | boolean | null | undefined,
  options: ValueNodeOptions = {},
): JQNode {
  const data: JQValueData = {
    type: JQNodeType.Value,
    name: options.name ?? `value_${id}`,
    valueType,
    value,
  };

  if (options.pathSegments) {
    data.pathSegments = options.pathSegments;
  }
  if (options.items) {
    data.items = options.items;
  }
  if (options.fields) {
    data.fields = options.fields;
  }

  return {
    id,
    type: JQNodeType.Value,
    position: { x: options.x ?? 0, y: options.y ?? 100 },
    data,
  };
}

/**
 * Creates a string Value node.
 */
export function createStringNode(
  id: string,
  value: string,
  options: PositionedNodeOptions = {},
): JQNode {
  return createValueNode(id, ValueType.String, value, options);
}

/**
 * Creates a number Value node.
 */
export function createNumberNode(
  id: string,
  value: number,
  options: PositionedNodeOptions = {},
): JQNode {
  return createValueNode(id, ValueType.Number, value, options);
}

/**
 * Creates a boolean Value node.
 */
export function createBooleanNode(
  id: string,
  value: boolean,
  options: PositionedNodeOptions = {},
): JQNode {
  return createValueNode(id, ValueType.Boolean, value, options);
}

/**
 * Creates a null Value node.
 */
export function createNullNode(id: string, options: PositionedNodeOptions = {}): JQNode {
  return createValueNode(id, ValueType.Null, null, options);
}

/**
 * Creates a path Value node.
 */
export function createPathNode(
  id: string,
  pathSegments: PathSegment[],
  options: PositionedNodeOptions = {},
): JQNode {
  return createValueNode(id, ValueType.Path, undefined, {
    ...options,
    pathSegments,
  });
}

/**
 * Creates a FunctionCall node for testing.
 */
export function createFunctionCallNode(
  id: string,
  selectedFunction: string,
  options: FunctionCallNodeOptions = {},
): JQNode {
  const data: JQFunctionCallData = {
    type: JQNodeType.FunctionCall,
    name: options.name ?? `func_${id}`,
    callType: options.callType ?? 'builtin',
    selectedFunction,
  };

  return {
    id,
    type: JQNodeType.FunctionCall,
    position: { x: options.x ?? 0, y: options.y ?? 100 },
    data,
  };
}

/**
 * Creates an Operator node for testing.
 */
export function createOperatorNode(
  id: string,
  operator: string,
  options: PositionedNodeOptions = {},
): JQNode {
  const data: JQOperatorData = {
    type: JQNodeType.Operator,
    name: options.name ?? `op_${id}`,
    operator,
  };

  return {
    id,
    type: JQNodeType.Operator,
    position: { x: options.x ?? 0, y: options.y ?? 100 },
    data,
  };
}

/**
 * Creates a Condition node for testing.
 */
export function createConditionNode(
  id: string,
  branches: JQConditionBranch[],
  options: PositionedNodeOptions = {},
): JQNode {
  const data: JQConditionData = {
    type: JQNodeType.Condition,
    name: options.name ?? `cond_${id}`,
    branches,
  };

  return {
    id,
    type: JQNodeType.Condition,
    position: { x: options.x ?? 0, y: options.y ?? 100 },
    data,
  };
}

/**
 * Creates a TryCatch node for testing.
 */
export function createTryCatchNode(id: string, options: PositionedNodeOptions = {}): JQNode {
  const data: JQTryCatchData = {
    type: JQNodeType.TryCatch,
    name: options.name,
  };

  return {
    id,
    type: JQNodeType.TryCatch,
    position: { x: options.x ?? 0, y: options.y ?? 100 },
    data,
  };
}

/**
 * Creates a FunctionDecl node for testing.
 */
export function createFunctionDeclNode(
  id: string,
  parameters: string[] = [],
  options: PositionedNodeOptions = {},
): JQNode {
  const data: JQFunctionDeclData = {
    type: JQNodeType.FunctionDecl,
    name: options.name ?? `func_${id}`,
    parameters,
  };

  return {
    id,
    type: JQNodeType.FunctionDecl,
    position: { x: options.x ?? 0, y: options.y ?? 100 },
    data,
  };
}

/**
 * Creates an edge for testing.
 */
export function createEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle: string = JQHandleIdPrefix.Flow,
  targetHandle: string = JQHandleIdPrefix.Top,
): JQEdge {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
  };
}

/**
 * Creates a flow edge (Start -> next node).
 */
export function createFlowEdge(id: string, source: string, target: string): JQEdge {
  return createEdge(id, source, target, JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top);
}

/**
 * Creates a parameter edge (param -> function).
 */
export function createParamEdge(
  id: string,
  source: string,
  target: string,
  paramIndex: number,
): JQEdge {
  return createEdge(
    id,
    source,
    target,
    JQHandleIdPrefix.Bottom,
    `${JQHandleIdPrefix.Param}:${String(paramIndex)}`,
  );
}

/**
 * Creates a simple linear flow: Start -> Node1 -> Node2.
 */
export function createLinearFlow(nodes: JQNode[]): { nodes: JQNode[]; edges: JQEdge[] } {
  const allNodes = [createStartNode(), ...nodes];
  const edges: JQEdge[] = [];

  for (let i = 0; i < allNodes.length - 1; i++) {
    const a = allNodes[i];
    const b = allNodes[i + 1];
    if (a && b) edges.push(createFlowEdge(`e${String(i)}`, a.id, b.id));
  }

  return { nodes: allNodes, edges };
}

/**
 * Creates a simple path segment.
 */
export function createPathSegment(
  id: string,
  type: 'root' | 'node_ref' | 'field' | 'index' | 'range',
  value: string,
  rangeEnd?: string,
): PathSegment {
  const segment: PathSegment = { id, type, value };
  if (rangeEnd !== undefined) {
    segment.rangeEnd = rangeEnd;
  }
  return segment;
}

/**
 * Validates that a flow graph is well-formed.
 */
export function validateFlowGraph(
  nodes: JQNode[],
  edges: JQEdge[],
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for Start node
  const startNodes = nodes.filter((n) => n.data.type === JQNodeType.Start);
  if (startNodes.length === 0) {
    errors.push('No Start node found');
  } else if (startNodes.length > 1) {
    errors.push('Multiple Start nodes found');
  }

  // Check for duplicate node IDs
  const nodeIds = nodes.map((n) => n.id);
  const uniqueNodeIds = new Set(nodeIds);
  if (nodeIds.length !== uniqueNodeIds.size) {
    errors.push('Duplicate node IDs found');
  }

  // Check for duplicate edge IDs
  const edgeIds = edges.map((e) => e.id);
  const uniqueEdgeIds = new Set(edgeIds);
  if (edgeIds.length !== uniqueEdgeIds.size) {
    errors.push('Duplicate edge IDs found');
  }

  // Check that all edges reference valid nodes
  const nodeIdSet = new Set(nodeIds);
  edges.forEach((edge, i) => {
    if (!nodeIdSet.has(edge.source)) {
      errors.push(`Edge ${String(i)} references invalid source node: ${edge.source}`);
    }
    if (!nodeIdSet.has(edge.target)) {
      errors.push(`Edge ${String(i)} references invalid target node: ${edge.target}`);
    }
  });

  // Check that all nodes have valid positions
  nodes.forEach((node, i) => {
    if (typeof node.position.x !== 'number' || isNaN(node.position.x)) {
      errors.push(`Node ${String(i)} has invalid x position`);
    }
    if (typeof node.position.y !== 'number' || isNaN(node.position.y)) {
      errors.push(`Node ${String(i)} has invalid y position`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Asserts that a flow graph is well-formed.
 */
export function assertValidFlowGraph(nodes: JQNode[], edges: JQEdge[]): void {
  const validation = validateFlowGraph(nodes, edges);
  if (!validation.valid) {
    throw new Error(`Invalid flow graph:\n${validation.errors.join('\n')}`);
  }
}

/**
 * Creates a Comment node for testing.
 */
export function createCommentNode(
  id: string,
  text: string,
  options: PositionedNodeOptions = {},
): JQNode {
  const data: JQCommentData = {
    type: JQNodeType.Comment,
    text,
  };

  return {
    id,
    type: JQNodeType.Comment,
    position: { x: options.x ?? 300, y: options.y ?? 100 },
    data,
  };
}

/**
 * Creates a chain edge (standard bottom→top connection).
 */
export function createChainEdge(id: string, source: string, target: string): JQEdge {
  return createEdge(id, source, target, JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top);
}

/** Instantiated on first {@link execJq} call, then reused by every later call. */
let jqPromise: Promise<JqModule> | null = null;

/**
 * Instantiates the jq WASM runtime.
 *
 * The jq-web glue exposes the Emscripten factory without eagerly invoking it, so
 * it is invoked here with an explicit locateFile pointing at the package's own
 * wasm on disk — the module reads the binary via the filesystem, which requires
 * the caller's suite to run in vitest's node environment.
 */
function loadJq(): Promise<JqModule> {
  if (!jqPromise) {
    const require = createRequire(import.meta.url);
    const jqFactory = require('jq-web') as JqFactory & { factory?: JqFactory };
    const factory = jqFactory.factory ?? jqFactory;
    const wasmPath = join(dirname(require.resolve('jq-web')), 'jq.wasm');
    jqPromise = factory({ locateFile: () => wasmPath });
  }
  return jqPromise;
}

/**
 * Compiles and runs a jq expression against an input through the real jq WASM
 * runtime, which rejects a malformed expression as a syntax error.
 *
 * Named apart from the app's `runJq` in `utils/jq-loader`: that one takes a JSON
 * *string* and resolves to a structured `JqResult` that reports failure in a
 * field, whereas this one takes a parsed value, resolves to the parsed output,
 * and rejects on a jq error so a test fails on malformed jq.
 *
 * @param expression - The jq expression to run
 * @param input - The JSON input to run it against
 * @returns The jq output
 */
export async function execJq(expression: string, input: unknown): Promise<unknown> {
  const jq = await loadJq();
  return jq.json(input, expression);
}
