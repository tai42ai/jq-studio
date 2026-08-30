/**
 * @fileoverview Flow graph validation system.
 *
 * Validates the visual jq flow graph and returns per-node errors.
 * Each validation rule is a standalone function that returns a ValidationErrorMap.
 * The main `validateFlow` function runs all rules and merges results.
 */

import { type Node, type Edge } from '@xyflow/react';
import { JQNodeType, JQHandleIdPrefix, VALID_NAME_PATTERN, JQ_RESERVED_KEYWORDS } from '../enums';
import { type JQNodeData } from '../types';
import { getFunctionDefById, getBuiltInFunctionNames } from './function-registry';
import { UNARY_OPERATORS } from '../operator-catalog';

export interface ValidationError {
  message: string;
  severity: 'error' | 'warning';
}

export type ValidationErrorMap = Map<string, ValidationError[]>;

type ValidatorFn = (nodes: Node<JQNodeData>[], edges: Edge[]) => ValidationErrorMap;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeErrors(target: ValidationErrorMap, source: ValidationErrorMap): void {
  for (const [nodeId, errors] of source) {
    const existing = target.get(nodeId) ?? [];
    target.set(nodeId, [...existing, ...errors]);
  }
}

function addError(
  map: ValidationErrorMap,
  nodeId: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
): void {
  const existing = map.get(nodeId) ?? [];
  existing.push({ message, severity });
  map.set(nodeId, existing);
}

// VALID_NAME_PATTERN imported from enums.ts

// ---------------------------------------------------------------------------
// Rule 1: No orphan nodes
// ---------------------------------------------------------------------------

function validateOrphanNodes(nodes: Node<JQNodeData>[], edges: Edge[]): ValidationErrorMap {
  const errors: ValidationErrorMap = new Map();
  const targetNodeIds = new Set(edges.map((e) => e.target));

  // Nodes with a left operator connection (right operands) are implicitly
  // part of the flow via the operator chain — not orphans.
  const rightOperandNodeIds = new Set(
    edges
      .filter((e) => e.sourceHandle?.startsWith(JQHandleIdPrefix.OperatorLeft))
      .map((e) => e.source),
  );

  for (const node of nodes) {
    // Start node is the root — it's never a target
    if (node.data.type === JQNodeType.Start) continue;

    // Comment nodes are optional annotations — never orphans
    if (node.data.type === JQNodeType.Comment) continue;

    if (rightOperandNodeIds.has(node.id)) continue;

    if (!targetNodeIds.has(node.id)) {
      addError(errors, node.id, 'Node is not connected to the flow');
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Rule 2–4: FunctionCall validation
// ---------------------------------------------------------------------------

function validateFunctionCalls(nodes: Node<JQNodeData>[], edges: Edge[]): ValidationErrorMap {
  const errors: ValidationErrorMap = new Map();

  for (const node of nodes) {
    if (node.data.type !== JQNodeType.FunctionCall) continue;
    const data = node.data;

    // Must have a selected function
    if (!data.selectedFunction) {
      addError(errors, node.id, 'No function selected');
      continue;
    }

    const outgoingEdges = edges.filter((e) => e.source === node.id);

    // Each parameter must be connected
    const funcDef = getFunctionDefById(data.selectedFunction);
    if (funcDef && funcDef.params.length > 0) {
      for (let i = 0; i < funcDef.params.length; i++) {
        const param = funcDef.params[i];
        if (!param) continue;
        // An optional parameter (a builtin with a valid zero-arg overload, e.g.
        // `first`/`last`) may be left unconnected — the serializer emits the bare
        // call. Only a REQUIRED, unconnected parameter is an error. This is the
        // fix for the round-trip that re-opened `… | first` with a spurious
        // "Parameter not connected" error and a disabled Save.
        if (param.optional) continue;
        const hasParam = outgoingEdges.some(
          (e) => e.sourceHandle === `${JQHandleIdPrefix.Param}:${String(i)}`,
        );
        if (!hasParam) {
          addError(errors, node.id, `Parameter "${param.name}" is not connected`);
        }
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Rule 5: Operator validation
// ---------------------------------------------------------------------------

function validateOperators(nodes: Node<JQNodeData>[], edges: Edge[]): ValidationErrorMap {
  const errors: ValidationErrorMap = new Map();

  for (const node of nodes) {
    if (node.data.type !== JQNodeType.Operator) continue;
    const data = node.data;
    const isUnary = UNARY_OPERATORS.has(data.operator);

    const incomingEdges = edges.filter((e) => e.target === node.id);

    const hasLeft = incomingEdges.some((e) => e.targetHandle === JQHandleIdPrefix.OperatorLeft);
    const hasRight = incomingEdges.some((e) => e.targetHandle === JQHandleIdPrefix.OperatorRight);

    if (!hasLeft) addError(errors, node.id, 'Left operand is missing');
    if (!hasRight && !isUnary) addError(errors, node.id, 'Right operand is missing');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Rule 6: Condition validation
// ---------------------------------------------------------------------------

function validateConditions(nodes: Node<JQNodeData>[], edges: Edge[]): ValidationErrorMap {
  const errors: ValidationErrorMap = new Map();

  for (const node of nodes) {
    if (node.data.type !== JQNodeType.Condition) continue;
    const data = node.data;
    const outgoingEdges = edges.filter((e) => e.source === node.id);

    // Each branch needs if + then
    for (let i = 0; i < data.branches.length; i++) {
      const label = i === 0 ? 'if' : `else if ${String(i)}`;

      const hasIf = outgoingEdges.some(
        (e) => e.sourceHandle === `${JQHandleIdPrefix.If}:${String(i)}`,
      );
      const hasThen = outgoingEdges.some(
        (e) => e.sourceHandle === `${JQHandleIdPrefix.Then}:${String(i)}`,
      );

      if (!hasIf) addError(errors, node.id, `"${label}" condition is not connected`);
      if (!hasThen) addError(errors, node.id, `"${label}" result is not connected`);
    }

    // Else must be connected
    const hasElse = outgoingEdges.some((e) => e.sourceHandle === JQHandleIdPrefix.Else);
    if (!hasElse) {
      addError(errors, node.id, '"else" branch is not connected');
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Rule 6b: TryCatch validation
// ---------------------------------------------------------------------------

function validateTryCatch(nodes: Node<JQNodeData>[], edges: Edge[]): ValidationErrorMap {
  const errors: ValidationErrorMap = new Map();

  for (const node of nodes) {
    if (node.data.type !== JQNodeType.TryCatch) continue;
    const outgoingEdges = edges.filter((e) => e.source === node.id);

    // Try handle must be connected
    const hasTry = outgoingEdges.some((e) => e.sourceHandle === JQHandleIdPrefix.Try);
    if (!hasTry) {
      addError(errors, node.id, '"try" logic is not connected');
    }

    // Catch is optional — warn if not connected
    const hasCatch = outgoingEdges.some((e) => e.sourceHandle === JQHandleIdPrefix.Catch);
    if (!hasCatch) {
      addError(errors, node.id, '"catch" logic is not connected', 'warning');
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Rule 7: Node name validation
// ---------------------------------------------------------------------------

function validateNodeNames(nodes: Node<JQNodeData>[]): ValidationErrorMap {
  const errors: ValidationErrorMap = new Map();

  // Build name frequency map (exclude Start, Comment, and unnamed nodes)
  const nameCount = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.data.type === JQNodeType.Start || node.data.type === JQNodeType.Comment) continue;
    const name = node.data.name;
    if (!name) continue;
    const ids = nameCount.get(name) ?? [];
    ids.push(node.id);
    nameCount.set(name, ids);
  }

  for (const node of nodes) {
    if (node.data.type === JQNodeType.Start || node.data.type === JQNodeType.Comment) continue;
    const name = node.data.name;

    // Name is optional — skip validation for unnamed nodes
    if (!name) continue;

    if (!VALID_NAME_PATTERN.test(name)) {
      addError(errors, node.id, 'Invalid name — use letters, numbers, and underscores');
    }

    // Duplicate check
    const ids = nameCount.get(name);
    if (ids && ids.length > 1) {
      addError(errors, node.id, `Duplicate name "${name}"`, 'warning');
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Rule 8: Start node validation
// ---------------------------------------------------------------------------

function validateStartNode(nodes: Node<JQNodeData>[], edges: Edge[]): ValidationErrorMap {
  const errors: ValidationErrorMap = new Map();

  for (const node of nodes) {
    if (node.data.type !== JQNodeType.Start) continue;

    const hasFlowOutput = edges.some(
      (e) => e.source === node.id && e.sourceHandle === JQHandleIdPrefix.Flow,
    );

    if (!hasFlowOutput) {
      addError(errors, node.id, 'No flow output connected');
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Rule 9: FunctionDecl validation
// ---------------------------------------------------------------------------

function validateFunctionDecls(nodes: Node<JQNodeData>[], edges: Edge[]): ValidationErrorMap {
  const errors: ValidationErrorMap = new Map();
  const reservedNames = [...getBuiltInFunctionNames(), ...JQ_RESERVED_KEYWORDS];

  for (const node of nodes) {
    if (node.data.type !== JQNodeType.FunctionDecl) continue;
    const data = node.data;

    // Function name is required (it's the function identifier)
    if (!data.name) {
      addError(errors, node.id, 'Function name is required');
    } else if (reservedNames.includes(data.name)) {
      addError(errors, node.id, `Function name "${data.name}" is a reserved word`);
    }

    // Must have logic body connected
    const outgoingEdges = edges.filter((e) => e.source === node.id);
    const hasLogic = outgoingEdges.some((e) => e.sourceHandle?.startsWith(JQHandleIdPrefix.Logic));
    if (!hasLogic) {
      addError(errors, node.id, 'Function body is not connected');
    }

    // Validate parameter names
    if (data.parameters) {
      const seen = new Set<string>();
      for (const param of data.parameters) {
        if (!param || param.length === 0) {
          addError(errors, node.id, 'Parameter name is required');
        } else if (!VALID_NAME_PATTERN.test(param)) {
          addError(errors, node.id, `Invalid parameter name "${param}"`);
        } else if (reservedNames.includes(param)) {
          addError(errors, node.id, `Parameter "${param}" is a reserved word`);
        } else if (seen.has(param)) {
          addError(errors, node.id, `Duplicate parameter "${param}"`);
        }
        if (param) seen.add(param);
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

const validators: ValidatorFn[] = [
  validateOrphanNodes,
  validateFunctionCalls,
  validateOperators,
  validateConditions,
  validateTryCatch,
  (nodes) => validateNodeNames(nodes),
  validateStartNode,
  validateFunctionDecls,
];

/**
 * Validates the entire flow graph and returns per-node errors.
 *
 * @param nodes - All nodes in the graph
 * @param edges - All edges in the graph
 * @returns Map of node ID → validation errors
 */
export function validateFlow(nodes: Node<JQNodeData>[], edges: Edge[]): ValidationErrorMap {
  const allErrors: ValidationErrorMap = new Map();

  for (const validate of validators) {
    const errors = validate(nodes, edges);
    mergeErrors(allErrors, errors);
  }

  return allErrors;
}
