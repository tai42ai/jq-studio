/**
 * @fileoverview Utility for finding the outermost operator in a nested operator chain.
 */

import { type JQNode, type JQEdge } from '../../../../types';
import { JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext } from '../types';
import { classifyEdge } from './edge-classifier';
import { enterChainNode, edgeTargetNode } from './validators';

/** Reports whether an edge leaves a node through an operator operand handle. */
function isOperatorOperandEdge(edge: JQEdge): boolean {
  return (
    (edge.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorLeft) ||
    (edge.sourceHandle ?? '').startsWith(JQHandleIdPrefix.OperatorRight)
  );
}

/**
 * Marks every operator nested inside `container`'s operand that starts at
 * `direct`, by walking the same right-operand containment chain the operand
 * resolver generates from: each step's right-operand source lists the next
 * containing operator at a higher edge index, and every operator the walk
 * visits before reaching `container` lives INSIDE that operand.
 *
 * Shared-source edge order alone cannot see these operators — when an operand
 * chain's entry is a node deep inside a sub-chain, the operators between the
 * chain's inner operator and `container` carry no edge from any node that also
 * feeds `container` — so without this walk they read as outermost candidates.
 */
function markOperatorsInsideOperand(
  direct: JQNode,
  containerId: string,
  context: ConversionContext,
  innerOps: Set<string>,
): void {
  const walked = new Set<string>([direct.id]);
  let current = direct;

  for (;;) {
    const incoming = context.edgesByTarget.get(current.id) ?? [];
    const rightEdge = incoming.find((e) =>
      e.targetHandle?.startsWith(JQHandleIdPrefix.OperatorRight),
    );
    if (!rightEdge) break;

    const rightOpEdges = (context.edgesBySource.get(rightEdge.source) ?? []).filter(
      isOperatorOperandEdge,
    );
    const currentIdx = rightOpEdges.findIndex((e) => e.target === current.id);
    if (currentIdx < 0) break;

    let next: JQNode | null = null;
    for (let i = currentIdx + 1; i < rightOpEdges.length; i++) {
      const edge = rightOpEdges[i];
      if (edge && edge.target !== containerId) {
        next = edgeTargetNode(context, edge);
        break;
      }
    }
    // The walked set bounds the walk on a malformed graph whose containment
    // edges cycle; marking stops where the cycle closes.
    if (!next || walked.has(next.id)) break;

    walked.add(next.id);
    innerOps.add(next.id);
    current = next;
  }
}

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
      if (isOperatorOperandEdge(edge)) {
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

  // Identify inner operators. A shared operand source lists its operator edges
  // in nesting order, so each edge's target is nested inside the next edge's
  // target — and the whole operand chain that STARTS at that inner operator is
  // nested along with it, which the containment walk marks (an operator whose
  // only edges come from nodes deep inside an operand would otherwise read as
  // an outermost candidate and serialise the expression down to its subtree).
  const innerOps = new Set<string>();
  for (const op of operators) {
    const incoming = context.edgesByTarget.get(op.id) ?? [];
    for (const edge of incoming) {
      const operandEdges = (context.edgesBySource.get(edge.source) ?? []).filter(
        isOperatorOperandEdge,
      );
      for (let i = 0; i < operandEdges.length - 1; i++) {
        const innerEdge = operandEdges[i];
        const containerEdge = operandEdges[i + 1];
        if (!innerEdge || !containerEdge) continue;
        innerOps.add(innerEdge.target);
        markOperatorsInsideOperand(
          edgeTargetNode(context, innerEdge),
          containerEdge.target,
          context,
          innerOps,
        );
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
    const opEdges = entryOutgoing.filter(isOperatorOperandEdge);
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
    const nextHasOpEdge = nextOutgoing.some(isOperatorOperandEdge);
    if (nextHasOpEdge) break;

    enterChainNode(visited, nextNode, bottomEdge);
    current = nextNode;
  }

  return current;
}
