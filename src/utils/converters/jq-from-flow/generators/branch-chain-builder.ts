/**
 * @fileoverview Shared branch chain expression builder.
 *
 * Builds piped expression chains by following bottom-handle edges from an entry node.
 * Used by the Condition, TryCatch and Value generators.
 */

import { type JQNode, type JQEdge } from '../../../../types';
import { JQNodeType, JQHandleIdPrefix } from '../../../../enums';
import { type ConversionContext } from '../types';
import { classifyEdge } from '../utils/edge-classifier';
import { shouldCreateVariable } from '../utils/variable-checker';
import { findOutermostOperator, findPipeChainEnd } from '../utils/operator-resolver';
import {
  type ExpressionPart,
  type OpenBinding,
  commentParts,
  joinExpressionParts,
  pushChainPart,
  closeOpenBinding,
  nextChainNode,
} from '../expression-builder';

/** Signature of the recursive node generator the generators receive as an argument. */
export type NodeExpressionFn = (
  node: JQNode,
  context: ConversionContext,
  indent?: number,
) => string;

/**
 * Builds a piped expression chain starting from a branch entry node.
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
 * - A node that creates a variable contributes `<expr> as $name`, with `| $name`
 *   appended when `pipeAfterDeclare` is set or when the chain ends on the binding.
 * - Every other node contributes exactly what nodeExpressionFn returns for it.
 *
 * Parts are joined inline: expressions separated by ` | `, comment parts rendered
 * as `# text` without a pipe. A `# text` part runs to the end of its line, so the
 * part following one continues on the next line, and a chain ending on a comment
 * is terminated with a newline so the branch's surrounding syntax survives.
 *
 * @throws {Error} If the chain consists of Comment nodes only — a branch needs an
 *   expression, and comments alone cannot supply one
 * @throws {Error} If the chain loops back on a node it already passed through
 */
export function buildBranchChainExpression(
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
      const commentOutgoing: JQEdge[] = context.edgesBySource.get(currentNode.id) ?? [];
      const commentNextEdge: JQEdge | undefined = commentOutgoing.find(
        (e) => classifyEdge(e).isBottomHandle,
      );
      currentNode = nextChainNode(commentNextEdge, context, visited);
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
    let pipeChainEndNode: JQNode = currentNode;
    if (hasOperatorEdge) {
      const operatorNode = findOutermostOperator(currentNode.id, context);
      nodeExpr = nodeExpressionFn(operatorNode, context, indent);
      // Skip past pipe chain nodes consumed by operator operands
      pipeChainEndNode = findPipeChainEnd(currentNode, context);
    } else {
      nodeExpr = nodeExpressionFn(currentNode, context, indent);
    }

    // Variable creation (standard name-based rules)
    openBinding = pushChainPart(
      parts,
      currentNode,
      nodeExpr,
      shouldCreateVariable(currentNode, context),
    );

    // Follow bottom handle from pipe chain end to next node
    const endOutgoing: JQEdge[] = context.edgesBySource.get(pipeChainEndNode.id) ?? [];
    const nextEdge: JQEdge | undefined = endOutgoing.find((e) => classifyEdge(e).isBottomHandle);
    currentNode = nextChainNode(nextEdge, context, visited);
  }

  closeOpenBinding(openBinding);

  return joinExpressionParts(parts, entryNode.id, true);
}
