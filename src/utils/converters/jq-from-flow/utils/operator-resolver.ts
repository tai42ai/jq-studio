/**
 * @fileoverview Utility for finding the outermost operator in a nested operator chain.
 */

import { type JQNode } from '../../../../types';
import { JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext } from '../types';
import { classifyEdge } from './edge-classifier';
import { enterChainNode, edgeTargetNode } from './validators';

/**
 * Finds the outermost operator in an operator chain connected to a value node.
 *
 * For nested operators like `.timestamp >= 1000 and .timestamp <= 2000`,
 * starting from the flow entry node (.timestamp), this traverses through
 * shared operand edges to find all connected operators, then identifies
 * the outermost one (the one that is NOT inner to any other operator).
 *
 * The search always names an operator or fails: a chain it cannot pick an outermost
 * operator from is a chain the flow does not draw, and answering with whichever
 * candidate happens to come first would emit an expression missing the operators
 * wrapped around it.
 *
 * @param nodeId - The value node ID to start from
 * @param context - Conversion context with edge maps
 * @returns The outermost operator node
 * @throws {Error} If an operator edge leads from a node back to that same node
 * @throws {Error} If the node feeds no operator at all
 * @throws {Error} If every operator in the chain is nested inside another
 */
export function findOutermostOperator(nodeId: string, context: ConversionContext): JQNode {
  const visited = new Set<string>();
  const operators: JQNode[] = [];

  function collectOperators(nid: string) {
    if (visited.has(nid)) return;
    visited.add(nid);

    const outgoing = context.edgesBySource.get(nid) ?? [];
    for (const edge of outgoing) {
      if (
        (edge.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
        (edge.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight)
      ) {
        const opNode = edgeTargetNode(context, edge);

        // A self-targeting operator edge names no operator; the visited set would
        // silently skip it and answer from the wrong operators.
        if (opNode.id === nid) {
          throw new Error(
            `Operand node ${nid} operator edge ${edge.id} targets itself — ` +
              'reconnect the edge to an operator node',
          );
        }

        if (!visited.has(opNode.id)) {
          visited.add(opNode.id);
          operators.push(opNode);

          // Traverse through this operator's operands to find further operators
          const incoming = context.edgesByTarget.get(opNode.id) ?? [];
          for (const inEdge of incoming) {
            collectOperators(inEdge.source);
          }
        }
      }
    }
  }

  collectOperators(nodeId);

  // Callers reach here because the node carries operator-handle edges, so the search
  // has an operator to name unless the graph connects the node to none.
  const firstOperator = operators[0];
  if (!firstOperator) {
    throw new Error(
      `Node ${nodeId} feeds no operator — the outermost-operator search runs only on a ` +
        'node whose operator handles reach an operator',
    );
  }
  if (operators.length === 1) return firstOperator;

  // Identify inner operators: for each operand with multiple operator edges,
  // all but the last edge's target are inner (earlier edges = inner operators)
  const innerOps = new Set<string>();
  for (const op of operators) {
    const incoming = context.edgesByTarget.get(op.id) ?? [];
    for (const edge of incoming) {
      const operandEdges = (context.edgesBySource.get(edge.source) ?? []).filter(
        (e) =>
          (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
          (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
      );
      if (operandEdges.length > 1) {
        for (let i = 0; i < operandEdges.length - 1; i++) {
          const oe = operandEdges[i];
          if (oe) innerOps.add(oe.target);
        }
      }
    }
  }

  // Exactly one operator in a valid chain is nested inside no other; if every
  // candidate is inner, picking one arbitrarily would drop the operators around it.
  const outermost = operators.find((op) => !innerOps.has(op.id));
  if (!outermost) {
    throw new Error(
      `Operator chain from node ${nodeId} has no outermost operator — every operator in it ` +
        `(${operators.map((op) => op.id).join(', ')}) is nested inside another — ` +
        'reconnect the operand edges so one operator contains the rest',
    );
  }
  return outermost;
}

/**
 * Finds the end of a pipe chain starting from a node, stopping before
 * any node that has its own operator connections.
 *
 * Used by expression builders to skip past pipe chain nodes that were
 * consumed by an operator's operand expression.
 *
 * @throws {Error} If the chain loops back on a node it already passed through — a
 *   chain that loops has no end to find
 */
export function findPipeChainEnd(node: JQNode, context: ConversionContext): JQNode {
  // Named nodes create `as $var` — their bottom edge is the main chain
  // continuation, not part of the operand pipe chain.
  if (node.data.name) return node;

  // Edge creation order check: if the entry node's bottom edge appears after
  // all operator edges, it was created by an outer Pipe AFTER the operator,
  // meaning it's the main chain continuation — not part of the operand.
  const entryOutgoing = context.edgesBySource.get(node.id) ?? [];
  const entryBottomEdge = entryOutgoing.find((e) => classifyEdge(e).isBottomHandle);
  if (entryBottomEdge) {
    const opEdges = entryOutgoing.filter(
      (e) =>
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
    );
    if (opEdges.length > 0) {
      const bottomIdx = entryOutgoing.indexOf(entryBottomEdge);
      const lastOpIdx = Math.max(...opEdges.map((e) => entryOutgoing.indexOf(e)));
      if (bottomIdx > lastOpIdx) {
        return node;
      }
    }
  }

  const visited = new Set<string>([node.id]);
  let current = node;

  for (;;) {
    const outgoing = context.edgesBySource.get(current.id) ?? [];
    const bottomEdge = outgoing.find((e) => classifyEdge(e).isBottomHandle);
    if (!bottomEdge) break;

    const nextNode = edgeTargetNode(context, bottomEdge);

    // Stop if next node has its own operator connections
    const nextOutgoing = context.edgesBySource.get(nextNode.id) ?? [];
    const nextHasOpEdge = nextOutgoing.some(
      (e) =>
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
        (e.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight),
    );
    if (nextHasOpEdge) break;

    enterChainNode(visited, nextNode, bottomEdge);
    current = nextNode;
  }

  return current;
}
