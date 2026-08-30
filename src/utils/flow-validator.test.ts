/**
 * @fileoverview Tests for flow graph validation system.
 */

import { describe, it, expect } from 'vitest';
import { validateFlow, type ValidationErrorMap } from './flow-validator';
import { getValidJQNodeTypesForConnection, validateJQConnection } from './validator';
import { type JQEdge } from '../types';
import { JQNodeType, JQHandleIdPrefix } from '../enums';
import {
  createStartNode,
  createValueNode,
  createFunctionCallNode,
  createFunctionDeclNode,
  createOperatorNode,
  createConditionNode,
  createTryCatchNode,
  createCommentNode,
} from './converters/test-helpers';
import { ValueType } from '../enums';

/** Helper: extract error messages for a given node ID */
const errorsFor = (map: ValidationErrorMap, nodeId: string) =>
  (map.get(nodeId) ?? []).map((e) => e.message);

/** Helper: extract error severities for a given node ID */
const severitiesFor = (map: ValidationErrorMap, nodeId: string) =>
  (map.get(nodeId) ?? []).map((e) => e.severity);

// ---------------------------------------------------------------------------
// Convenience wrappers (validator tests only care about id + name)
// ---------------------------------------------------------------------------

const startNode = (id = 'start') => createStartNode(id);

const valueNode = (id: string, name: string) => createValueNode(id, ValueType.Path, '.', { name });

const functionCallNode = (id: string, name: string, selectedFunction?: string) =>
  createFunctionCallNode(id, selectedFunction ?? '', { name, callType: 'builtin' });

const operatorNode = (id: string, name: string) => createOperatorNode(id, '+', { name });

const conditionNode = (id: string, name: string, branchCount = 1) =>
  createConditionNode(
    id,
    Array.from({ length: branchCount }, (_, i) => ({ id: `branch_${i}` })),
    { name },
  );

const edge = (
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string,
): JQEdge => ({
  id: `e-${source}-${target}-${sourceHandle ?? ''}`,
  source,
  target,
  sourceHandle: sourceHandle ?? undefined,
  targetHandle: targetHandle ?? undefined,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateFlow', () => {
  describe('clean graph', () => {
    it('should return no errors for a properly connected Start → Value flow', () => {
      const nodes = [startNode(), valueNode('v1', 'my_value')];
      const edges = [edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(result.size).toBe(0);
    });
  });

  describe('Rule 1: orphan nodes', () => {
    it('should flag a node not connected to any source', () => {
      const nodes = [startNode(), valueNode('v1', 'orphan')];
      const edges: JQEdge[] = []; // v1 has no incoming edge

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'v1')).toContain('Node is not connected to the flow');
    });

    it('should not flag Start node as orphan', () => {
      const nodes = [startNode()];
      const edges: JQEdge[] = [];

      const result = validateFlow(nodes, edges);
      // Start node might have its own errors (no flow output) but NOT orphan
      const startErrors = errorsFor(result, 'start');
      expect(startErrors).not.toContain('Node is not connected to the flow');
    });

    it('should not flag a node that IS a target of an edge', () => {
      const nodes = [startNode(), valueNode('v1', 'connected')];
      const edges = [edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'v1')).not.toContain('Node is not connected to the flow');
    });
  });

  describe('Rule 2-4: FunctionCall validation', () => {
    it('should flag FunctionCall with no selected function', () => {
      const nodes = [startNode(), functionCallNode('fc1', 'my_func')];
      const edges = [edge('start', 'fc1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'fc1')).toContain('No function selected');
    });

    it('should NOT flag FunctionCall with no root input (root is optional)', () => {
      const nodes = [startNode(), functionCallNode('fc1', 'my_func', 'map')];
      const edges = [edge('start', 'fc1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'fc1')).not.toContain('Input data source is required');
    });

    it('should not flag FunctionCall that has root input connected', () => {
      const nodes = [
        startNode(),
        functionCallNode('fc1', 'my_func', 'map'),
        valueNode('v1', 'input_val'),
      ];
      const edges = [
        edge('start', 'fc1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('fc1', 'v1', `${JQHandleIdPrefix.Root}:fc1`, JQHandleIdPrefix.Top),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'fc1')).not.toContain('Input data source is required');
    });

    it('should flag missing parameter connections', () => {
      // map has 1 parameter (f)
      const nodes = [
        startNode(),
        functionCallNode('fc1', 'my_func', 'map'),
        valueNode('v1', 'input_val'),
      ];
      const edges = [
        edge('start', 'fc1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('fc1', 'v1', `${JQHandleIdPrefix.Root}:fc1`, JQHandleIdPrefix.Top),
        // No param:0 edge
      ];

      const result = validateFlow(nodes, edges);
      const fcErrors = errorsFor(result, 'fc1');
      expect(fcErrors.some((e) => e.includes('is not connected'))).toBe(true);
    });

    it('does NOT flag a bare first/last (optional param) as unconnected [F6 round-trip fix]', () => {
      // `.x | first` round-trips to a zero-arg `first` call: its `filter` param
      // is optional (jq's bare `first` = the input's first element), so a fresh
      // graph opened from that expression must have ZERO param errors and a
      // savable canvas. Regression for the jq03 disabled-Save bug.
      for (const builtin of ['first', 'last']) {
        const nodes = [
          startNode(),
          functionCallNode('fc1', builtin, builtin),
          valueNode('v1', 'x'),
        ];
        const edges = [
          edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
          edge('v1', 'fc1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
          // No param:0 edge — the optional filter is intentionally omitted.
        ];
        const result = validateFlow(nodes, edges);
        expect(errorsFor(result, 'fc1').filter((e) => e.includes('is not connected'))).toEqual([]);
      }
    });

    it('still flags a REQUIRED param (map) as unconnected — optionality is not blanket', () => {
      const nodes = [startNode(), functionCallNode('fc1', 'map', 'map'), valueNode('v1', 'x')];
      const edges = [
        edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('v1', 'fc1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
      ];
      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'fc1').some((e) => e.includes('is not connected'))).toBe(true);
    });

    it('should skip param check when no function is selected', () => {
      const nodes = [startNode(), functionCallNode('fc1', 'my_func')];
      const edges = [edge('start', 'fc1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      const fcErrors = errorsFor(result, 'fc1');
      // Should have "No function selected" but NOT param errors
      expect(fcErrors).toContain('No function selected');
      expect(fcErrors.filter((e) => e.includes('Parameter'))).toHaveLength(0);
    });
  });

  describe('Rule 5: Operator validation', () => {
    it('should flag operator with no left operand', () => {
      const nodes = [startNode(), valueNode('v1', 'val1'), operatorNode('op1', 'my_op')];
      const edges = [
        edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        // Only right connected
        edge('v1', 'op1', JQHandleIdPrefix.OperatorRight, JQHandleIdPrefix.OperatorRight),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'op1')).toContain('Left operand is missing');
    });

    it('should flag operator with no right operand', () => {
      const nodes = [startNode(), valueNode('v1', 'val1'), operatorNode('op1', 'my_op')];
      const edges = [
        edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('v1', 'op1', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'op1')).toContain('Right operand is missing');
    });

    it('should flag operator with both sides missing', () => {
      const nodes = [startNode(), operatorNode('op1', 'my_op')];
      const edges = [edge('start', 'op1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      const opErrors = errorsFor(result, 'op1');
      expect(opErrors).toContain('Left operand is missing');
      expect(opErrors).toContain('Right operand is missing');
    });

    it('should not flag operator with both sides connected', () => {
      const nodes = [
        startNode(),
        valueNode('v1', 'left_val'),
        valueNode('v2', 'right_val'),
        operatorNode('op1', 'my_op'),
      ];
      const edges = [
        edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('v1', 'op1', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
        edge('v2', 'op1', JQHandleIdPrefix.OperatorRight, JQHandleIdPrefix.OperatorRight),
      ];

      const result = validateFlow(nodes, edges);
      const opErrors = errorsFor(result, 'op1');
      expect(opErrors).not.toContain('Left operand is missing');
      expect(opErrors).not.toContain('Right operand is missing');
    });
  });

  describe('Rule 6: Condition validation', () => {
    it('should flag condition with missing "if" connection', () => {
      const nodes = [
        startNode(),
        conditionNode('c1', 'my_cond'),
        valueNode('v1', 'then_val'),
        valueNode('v2', 'else_val'),
      ];
      const edges = [
        edge('start', 'c1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        // Then and Else connected, but no If
        edge('c1', 'v1', `${JQHandleIdPrefix.Then}:0`),
        edge('c1', 'v2', JQHandleIdPrefix.Else),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'c1')).toContain('"if" condition is not connected');
    });

    it('should flag condition with missing "then" connection', () => {
      const nodes = [
        startNode(),
        conditionNode('c1', 'my_cond'),
        valueNode('v1', 'if_val'),
        valueNode('v2', 'else_val'),
      ];
      const edges = [
        edge('start', 'c1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('c1', 'v1', `${JQHandleIdPrefix.If}:0`),
        edge('c1', 'v2', JQHandleIdPrefix.Else),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'c1')).toContain('"if" result is not connected');
    });

    it('should flag condition with missing else connection', () => {
      const nodes = [
        startNode(),
        conditionNode('c1', 'my_cond'),
        valueNode('v1', 'if_val'),
        valueNode('v2', 'then_val'),
      ];
      const edges = [
        edge('start', 'c1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('c1', 'v1', `${JQHandleIdPrefix.If}:0`),
        edge('c1', 'v2', `${JQHandleIdPrefix.Then}:0`),
        // No else
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'c1')).toContain('"else" branch is not connected');
    });

    it('should flag else-if branches independently', () => {
      const nodes = [
        startNode(),
        conditionNode('c1', 'my_cond', 2), // 2 branches: if + else-if
      ];
      const edges = [
        edge('start', 'c1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        // No connections at all
      ];

      const result = validateFlow(nodes, edges);
      const condErrors = errorsFor(result, 'c1');
      expect(condErrors).toContain('"if" condition is not connected');
      expect(condErrors).toContain('"if" result is not connected');
      expect(condErrors).toContain('"else if 1" condition is not connected');
      expect(condErrors).toContain('"else if 1" result is not connected');
      expect(condErrors).toContain('"else" branch is not connected');
    });
  });

  describe('Rule 7: Node name validation', () => {
    it('should NOT flag empty node names (name is optional)', () => {
      const nodes = [startNode(), valueNode('v1', '')];
      const edges = [edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'v1')).not.toContain('Node name is required');
    });

    it('should flag invalid node names', () => {
      const nodes = [startNode(), valueNode('v1', '123invalid')];
      const edges = [edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'v1')).toContain(
        'Invalid name — use letters, numbers, and underscores',
      );
    });

    it('should flag names with spaces', () => {
      const nodes = [startNode(), valueNode('v1', 'my value')];
      const edges = [edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'v1')).toContain(
        'Invalid name — use letters, numbers, and underscores',
      );
    });

    it('should accept valid names', () => {
      const nodes = [startNode(), valueNode('v1', 'my_value_123')];
      const edges = [edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'v1')).not.toContain('Node name is required');
      expect(errorsFor(result, 'v1')).not.toContain(
        'Invalid name — use letters, numbers, and underscores',
      );
    });

    it('should flag duplicate names as warnings', () => {
      const nodes = [startNode(), valueNode('v1', 'same_name'), valueNode('v2', 'same_name')];
      const edges = [
        edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('v1', 'v2', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'v1')).toContain('Duplicate name "same_name"');
      expect(errorsFor(result, 'v2')).toContain('Duplicate name "same_name"');
      // Should be warnings, not errors
      expect(severitiesFor(result, 'v1')).toContain('warning');
      expect(severitiesFor(result, 'v2')).toContain('warning');
    });

    it('should not check name on Start node', () => {
      const nodes = [startNode()];
      const edges: JQEdge[] = [];

      const result = validateFlow(nodes, edges);
      const startErrors = errorsFor(result, 'start');
      expect(startErrors).not.toContain('Node name is required');
      expect(startErrors).not.toContain('Invalid name — use letters, numbers, and underscores');
    });
  });

  describe('Rule 8: Start node validation', () => {
    it('should flag Start node with no flow output', () => {
      const nodes = [startNode()];
      const edges: JQEdge[] = [];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'start')).toContain('No flow output connected');
    });

    it('should not flag Start node with flow output connected', () => {
      const nodes = [startNode(), valueNode('v1', 'my_val')];
      const edges = [edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'start')).not.toContain('No flow output connected');
    });

    it('should not count functions handle as flow output', () => {
      const nodes = [startNode(), createFunctionDeclNode('fd1', [], { name: 'my_func' })];
      const edges = [edge('start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      // Start should still have "no flow output" even if functions handle is connected
      expect(errorsFor(result, 'start')).toContain('No flow output connected');
    });
  });

  describe('Rule 5b: Unary operator validation', () => {
    it('should NOT flag missing right operand for unary operators (not)', () => {
      const nodes = [
        startNode(),
        valueNode('v1', 'left_val'),
        createOperatorNode('op1', 'not', { name: 'my_not' }),
      ];
      const edges = [
        edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('v1', 'op1', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      ];

      const result = validateFlow(nodes, edges);
      const opErrors = errorsFor(result, 'op1');
      expect(opErrors).not.toContain('Left operand is missing');
      expect(opErrors).not.toContain('Right operand is missing');
    });

    it('should NOT flag missing right operand for error-suppression operator (?)', () => {
      const nodes = [
        startNode(),
        valueNode('v1', 'left_val'),
        createOperatorNode('op1', '?', { name: 'my_try' }),
      ];
      const edges = [
        edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('v1', 'op1', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
      ];

      const result = validateFlow(nodes, edges);
      const opErrors = errorsFor(result, 'op1');
      expect(opErrors).not.toContain('Right operand is missing');
    });

    it('should still flag missing left operand for unary operators', () => {
      const nodes = [startNode(), createOperatorNode('op1', 'not', { name: 'my_not' })];
      const edges = [edge('start', 'op1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'op1')).toContain('Left operand is missing');
    });
  });

  describe('Rule 9: FunctionDecl validation', () => {
    it('should flag FunctionDecl with no logic body connected', () => {
      const nodes = [startNode(), createFunctionDeclNode('fd1', [], { name: 'my_func' })];
      const edges = [edge('start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'fd1')).toContain('Function body is not connected');
    });

    it('should not flag FunctionDecl with logic body connected', () => {
      const nodes = [
        startNode(),
        createFunctionDeclNode('fd1', [], { name: 'my_func' }),
        valueNode('v1', 'body_val'),
      ];
      const edges = [
        edge('start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
        edge('fd1', 'v1', JQHandleIdPrefix.Logic, JQHandleIdPrefix.Top),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'fd1')).not.toContain('Function body is not connected');
    });

    it('should flag invalid parameter names', () => {
      const nodes = [
        startNode(),
        createFunctionDeclNode('fd1', ['valid_param', '123bad'], { name: 'my_func' }),
        valueNode('v1', 'body_val'),
      ];
      const edges = [
        edge('start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
        edge('fd1', 'v1', JQHandleIdPrefix.Logic, JQHandleIdPrefix.Top),
      ];

      const result = validateFlow(nodes, edges);
      const fdErrors = errorsFor(result, 'fd1');
      expect(fdErrors.some((e) => e.includes('123bad'))).toBe(true);
      expect(fdErrors.some((e) => e.includes('valid_param'))).toBe(false);
    });

    it('should flag empty parameter names', () => {
      const nodes = [
        startNode(),
        createFunctionDeclNode('fd1', [''], { name: 'my_func' }),
        valueNode('v1', 'body_val'),
      ];
      const edges = [
        edge('start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
        edge('fd1', 'v1', JQHandleIdPrefix.Logic, JQHandleIdPrefix.Top),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'fd1')).toContain('Parameter name is required');
    });
  });

  describe('complex clean graph', () => {
    it('should return no errors for a fully connected multi-type flow', () => {
      const nodes = [
        startNode(),
        valueNode('v1', 'input_val'),
        functionCallNode('fc1', 'mapper', 'map'),
        valueNode('v2', 'root_input'),
        valueNode('v3', 'param_val'),
        operatorNode('op1', 'add_op'),
        valueNode('v4', 'left_val'),
        valueNode('v5', 'right_val'),
        conditionNode('c1', 'my_cond'),
        valueNode('v6', 'if_val'),
        valueNode('v7', 'then_val'),
        valueNode('v8', 'else_val'),
        createFunctionDeclNode('fd1', ['x'], { name: 'helper' }),
        valueNode('v9', 'func_body'),
      ];
      const edges = [
        // Main flow: start → v1 → fc1 → c1
        edge('start', 'v1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('v1', 'fc1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        // FunctionCall: root + param connected
        edge('fc1', 'v2', `${JQHandleIdPrefix.Root}:fc1`, JQHandleIdPrefix.Top),
        edge('fc1', 'v3', `${JQHandleIdPrefix.Param}:0`, JQHandleIdPrefix.Top),
        // Operator: both sides connected, operands chained from param
        edge('v3', 'v4', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('v4', 'v5', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('v4', 'op1', JQHandleIdPrefix.OperatorLeft, JQHandleIdPrefix.OperatorLeft),
        edge('v5', 'op1', JQHandleIdPrefix.OperatorRight, JQHandleIdPrefix.OperatorRight),
        // Condition: if + then + else
        edge('fc1', 'c1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
        edge('c1', 'v6', `${JQHandleIdPrefix.If}:0`, JQHandleIdPrefix.Top),
        edge('c1', 'v7', `${JQHandleIdPrefix.Then}:0`, JQHandleIdPrefix.Top),
        edge('c1', 'v8', JQHandleIdPrefix.Else, JQHandleIdPrefix.Top),
        // FunctionDecl: functions handle + logic body
        edge('start', 'fd1', JQHandleIdPrefix.Functions, JQHandleIdPrefix.Top),
        edge('fd1', 'v9', JQHandleIdPrefix.Logic, JQHandleIdPrefix.Top),
      ];

      const result = validateFlow(nodes, edges);
      expect(result.size).toBe(0);
    });
  });

  describe('Rule 6b: TryCatch validation', () => {
    it('should flag TryCatch with missing try connection', () => {
      const nodes = [startNode(), createTryCatchNode('tc1')];
      const edges = [edge('start', 'tc1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top)];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'tc1')).toContain('"try" logic is not connected');
    });

    it('should warn when catch connection is missing', () => {
      const nodes = [startNode(), createTryCatchNode('tc1'), valueNode('v1', 'try_val')];
      const edges = [
        edge('start', 'tc1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('tc1', 'v1', JQHandleIdPrefix.Try),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'tc1')).toContain('"catch" logic is not connected');
      expect(severitiesFor(result, 'tc1')).toContain('warning');
    });

    it('should not flag fully connected TryCatch', () => {
      const nodes = [
        startNode(),
        createTryCatchNode('tc1'),
        valueNode('v1', 'try_val'),
        valueNode('v2', 'catch_val'),
      ];
      const edges = [
        edge('start', 'tc1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
        edge('tc1', 'v1', JQHandleIdPrefix.Try),
        edge('tc1', 'v2', JQHandleIdPrefix.Catch),
      ];

      const result = validateFlow(nodes, edges);
      expect(errorsFor(result, 'tc1')).not.toContain('"try" logic is not connected');
      expect(errorsFor(result, 'tc1')).not.toContain('"catch" logic is not connected');
    });
  });

  describe('multiple rules combine', () => {
    it('should report errors from multiple rules on the same node', () => {
      const nodes = [startNode(), functionCallNode('fc1', '')]; // empty name + no function
      const edges: JQEdge[] = []; // orphan too

      const result = validateFlow(nodes, edges);
      const fcErrors = errorsFor(result, 'fc1');
      expect(fcErrors).toContain('Node is not connected to the flow');
      expect(fcErrors).toContain('No function selected');
      // A node name is optional, so an empty one is never reported as an error.
      expect(fcErrors).not.toContain('Node name is required');
    });
  });
});

describe('Connection Validation: FunctionCall as item/field/param/root target', () => {
  describe('getValidJQNodeTypesForConnection', () => {
    it('should allow FunctionCall as target of item: handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Value,
        'source',
        `${JQHandleIdPrefix.Item}:0`,
      );
      expect(types).toContain(JQNodeType.FunctionCall);
      expect(types).toContain(JQNodeType.Value);
    });

    it('should allow FunctionCall as target of field: handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Value,
        'source',
        `${JQHandleIdPrefix.Field}:0`,
      );
      expect(types).toContain(JQNodeType.FunctionCall);
      expect(types).toContain(JQNodeType.Value);
    });

    it('should allow FunctionCall as target of root: handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.FunctionCall,
        'source',
        `${JQHandleIdPrefix.Root}:fc1`,
      );
      expect(types).toContain(JQNodeType.FunctionCall);
      expect(types).toContain(JQNodeType.Value);
    });

    it('should allow FunctionCall as target of param: handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.FunctionCall,
        'source',
        `${JQHandleIdPrefix.Param}:0`,
      );
      expect(types).toContain(JQNodeType.FunctionCall);
      expect(types).toContain(JQNodeType.Value);
      expect(types).toContain(JQNodeType.Condition);
    });
  });

  describe('validateJQConnection', () => {
    it('should accept FunctionCall as target of item: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Value,
          JQNodeType.FunctionCall,
          `${JQHandleIdPrefix.Item}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept FunctionCall as target of field: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Value,
          JQNodeType.FunctionCall,
          `${JQHandleIdPrefix.Field}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept FunctionCall as target of root: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.FunctionCall,
          JQNodeType.FunctionCall,
          `${JQHandleIdPrefix.Root}:fc1`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept FunctionCall as target of param: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.FunctionCall,
          JQNodeType.FunctionCall,
          `${JQHandleIdPrefix.Param}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should still reject Operator as target of item: handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Value,
          JQNodeType.Operator,
          `${JQHandleIdPrefix.Item}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(false);
    });
  });
});

describe('Connection Validation: operator operand handles', () => {
  // The jq generator reads an operand's operator nesting off that operand's own
  // operator-handle edges, so an edge into an operator drawn from any other
  // handle leaves the graph unconvertible — and unsaveable.
  it('should accept an operand reaching an operator over its operator handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.Value,
        JQNodeType.Operator,
        `${JQHandleIdPrefix.OperatorLeft}:v1`,
        JQHandleIdPrefix.OperatorLeft,
      ),
    ).toBe(true);
    expect(
      validateJQConnection(
        JQNodeType.FunctionCall,
        JQNodeType.Operator,
        `${JQHandleIdPrefix.OperatorRight}:fc1`,
        JQHandleIdPrefix.OperatorRight,
      ),
    ).toBe(true);
  });

  it('should refuse an operand reaching an operator over its bottom handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.Value,
        JQNodeType.Operator,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.OperatorLeft,
      ),
    ).toBe(false);
    expect(
      validateJQConnection(
        JQNodeType.Value,
        JQNodeType.Operator,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.OperatorRight,
      ),
    ).toBe(false);
  });

  it('should refuse an operand reaching an operator over a param handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.FunctionCall,
        JQNodeType.Operator,
        `${JQHandleIdPrefix.Param}:0`,
        JQHandleIdPrefix.OperatorLeft,
      ),
    ).toBe(false);
  });

  it('should refuse a node type that is no operand on an operator target handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.Condition,
        JQNodeType.Operator,
        `${JQHandleIdPrefix.OperatorLeft}:c1`,
        JQHandleIdPrefix.OperatorLeft,
      ),
    ).toBe(false);
  });
});

describe('Connection Validation: TryCatch', () => {
  describe('getValidJQNodeTypesForConnection', () => {
    it('should allow Value and FunctionCall as targets of try handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.TryCatch,
        'source',
        JQHandleIdPrefix.Try,
      );
      expect(types).toContain(JQNodeType.Value);
      expect(types).toContain(JQNodeType.FunctionCall);
    });

    it('should allow Value and FunctionCall as targets of catch handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.TryCatch,
        'source',
        JQHandleIdPrefix.Catch,
      );
      expect(types).toContain(JQNodeType.Value);
      expect(types).toContain(JQNodeType.FunctionCall);
    });

    it('should allow Condition and TryCatch as targets of try handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.TryCatch,
        'source',
        JQHandleIdPrefix.Try,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });

    it('should allow Condition and TryCatch as targets of catch handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.TryCatch,
        'source',
        JQHandleIdPrefix.Catch,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });
  });

  describe('validateJQConnection', () => {
    it('should accept Value as target of try handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.TryCatch,
          JQNodeType.Value,
          JQHandleIdPrefix.Try,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept FunctionCall as target of catch handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.TryCatch,
          JQNodeType.FunctionCall,
          JQHandleIdPrefix.Catch,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept Condition as target of try handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.TryCatch,
          JQNodeType.Condition,
          JQHandleIdPrefix.Try,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept TryCatch as target of catch handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.TryCatch,
          JQNodeType.TryCatch,
          JQHandleIdPrefix.Catch,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept TryCatch as target from Start flow handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Start,
          JQNodeType.TryCatch,
          JQHandleIdPrefix.Flow,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });
  });
});

describe('Connection Validation: Condition side handles', () => {
  describe('getValidJQNodeTypesForConnection', () => {
    it('should allow Condition and TryCatch as targets of if handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Condition,
        'source',
        `${JQHandleIdPrefix.If}:0`,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });

    it('should allow Condition and TryCatch as targets of then handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Condition,
        'source',
        `${JQHandleIdPrefix.Then}:0`,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });

    it('should allow Condition and TryCatch as targets of else handle', () => {
      const types = getValidJQNodeTypesForConnection(
        JQNodeType.Condition,
        'source',
        JQHandleIdPrefix.Else,
      );
      expect(types).toContain(JQNodeType.Condition);
      expect(types).toContain(JQNodeType.TryCatch);
    });
  });

  describe('validateJQConnection', () => {
    it('should accept Condition as target of if handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Condition,
          JQNodeType.Condition,
          `${JQHandleIdPrefix.If}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept TryCatch as target of then handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Condition,
          JQNodeType.TryCatch,
          `${JQHandleIdPrefix.Then}:0`,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept Condition as target of else handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Condition,
          JQNodeType.Condition,
          JQHandleIdPrefix.Else,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });

    it('should accept TryCatch as target of else handle', () => {
      expect(
        validateJQConnection(
          JQNodeType.Condition,
          JQNodeType.TryCatch,
          JQHandleIdPrefix.Else,
          JQHandleIdPrefix.Top,
        ),
      ).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Comment Node Validation
// ---------------------------------------------------------------------------

describe('Comment Node Validation', () => {
  it('should NOT report orphan error for unconnected Comment node', () => {
    const nodes = [createStartNode(), createCommentNode('c1', 'some note')];
    const edges: JQEdge[] = [];

    const errors = validateFlow(nodes, edges);
    const commentErrors = errors.get('c1');
    // Comment node should not be flagged as orphan
    expect(commentErrors?.some((e) => e.message.includes('not connected'))).toBeFalsy();
  });

  it('should allow bottom→top connection from Value to Comment', () => {
    expect(
      validateJQConnection(
        JQNodeType.Value,
        JQNodeType.Comment,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.Top,
      ),
    ).toBe(true);
  });

  it('should allow bottom→top connection from Comment to pipeline node', () => {
    expect(
      validateJQConnection(
        JQNodeType.Comment,
        JQNodeType.Value,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.Top,
      ),
    ).toBe(true);
  });

  it('should reject Comment→Comment connections', () => {
    expect(
      validateJQConnection(
        JQNodeType.Comment,
        JQNodeType.Comment,
        JQHandleIdPrefix.Bottom,
        JQHandleIdPrefix.Top,
      ),
    ).toBe(false);
  });

  it('should allow Comment as target from Start flow handle', () => {
    expect(
      validateJQConnection(
        JQNodeType.Start,
        JQNodeType.Comment,
        JQHandleIdPrefix.Flow,
        JQHandleIdPrefix.Top,
      ),
    ).toBe(true);
  });

  it('should include Comment in valid types for bottom source handle', () => {
    const validTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Value,
      'source',
      JQHandleIdPrefix.Bottom,
    );
    expect(validTypes).toContain(JQNodeType.Comment);
  });

  it('should include pipeline nodes as valid types for Comment bottom handle', () => {
    const validTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Comment,
      'source',
      JQHandleIdPrefix.Bottom,
    );
    expect(validTypes).toContain(JQNodeType.Value);
    expect(validTypes).toContain(JQNodeType.FunctionCall);
    // Comment→Comment is NOT allowed
    expect(validTypes).not.toContain(JQNodeType.Comment);
  });

  it('should include Comment in valid flow handle targets', () => {
    const validTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Start,
      'source',
      JQHandleIdPrefix.Flow,
    );
    expect(validTypes).toContain(JQNodeType.Comment);
  });

  it('should NOT include Comment as valid target for param/item/field handles', () => {
    const paramTypes = getValidJQNodeTypesForConnection(
      JQNodeType.FunctionCall,
      'source',
      `${JQHandleIdPrefix.Param}:0`,
    );
    expect(paramTypes).not.toContain(JQNodeType.Comment);

    const itemTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Value,
      'source',
      `${JQHandleIdPrefix.Item}:0`,
    );
    expect(itemTypes).not.toContain(JQNodeType.Comment);

    const fieldTypes = getValidJQNodeTypesForConnection(
      JQNodeType.Value,
      'source',
      `${JQHandleIdPrefix.Field}:0`,
    );
    expect(fieldTypes).not.toContain(JQNodeType.Comment);
  });

  it('should allow Comment in chain: Start → Comment → Value validates cleanly', () => {
    const nodes = [
      createStartNode(),
      createCommentNode('c1', 'some note'),
      valueNode('v1', 'my_val'),
    ];
    const edges = [
      edge('start', 'c1', JQHandleIdPrefix.Flow, JQHandleIdPrefix.Top),
      edge('c1', 'v1', JQHandleIdPrefix.Bottom, JQHandleIdPrefix.Top),
    ];

    const errors = validateFlow(nodes, edges);
    // No errors for the comment node
    expect(errors.get('c1')).toBeUndefined();
    // Start should not complain about flow output since it IS connected
    expect(errorsFor(errors, 'start')).not.toContain('No flow output connected');
  });
});
