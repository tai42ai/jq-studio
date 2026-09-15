/**
 * @fileoverview Tests for connection and wiring validation of flow graphs.
 */

import { describe, expect, it } from 'vitest';

import { JQHandleIdPrefix } from '../enums';
import { type JQEdge } from '../types';
import { createOperatorNode, createTryCatchNode } from './converters/test-helpers';
import { validateFlow } from './flow-validator';
import {
  conditionNode,
  edge,
  errorsFor,
  functionCallNode,
  operatorNode,
  severitiesFor,
  startNode,
  valueNode,
} from './flow-validator-test-helpers';

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

    it('does NOT flag a bare first/last (optional param) as unconnected', () => {
      // `.x | first` round-trips to a zero-arg `first` call: its `filter` param
      // is optional (jq's bare `first` = the input's first element), so a fresh
      // graph opened from that expression must have ZERO param errors and a
      // savable canvas.
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
});
