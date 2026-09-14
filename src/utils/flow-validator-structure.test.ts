/**
 * @fileoverview Tests for node-name, Start-node, function-declaration, and
 * whole-graph structural validation of flow graphs.
 */

import { describe, it, expect } from 'vitest';
import { validateFlow } from './flow-validator';
import { type JQEdge } from '../types';
import { JQHandleIdPrefix } from '../enums';
import {
  createStartNode,
  createFunctionDeclNode,
  createCommentNode,
} from './converters/test-helpers';
import {
  errorsFor,
  severitiesFor,
  startNode,
  valueNode,
  functionCallNode,
  operatorNode,
  conditionNode,
  edge,
} from './flow-validator-test-helpers';

describe('validateFlow', () => {
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

describe('Comment Node Validation', () => {
  it('should NOT report orphan error for unconnected Comment node', () => {
    const nodes = [createStartNode(), createCommentNode('c1', 'some note')];
    const edges: JQEdge[] = [];

    const errors = validateFlow(nodes, edges);
    const commentErrors = errors.get('c1');
    // Comment node should not be flagged as orphan
    expect(commentErrors?.some((e) => e.message.includes('not connected'))).toBeFalsy();
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
