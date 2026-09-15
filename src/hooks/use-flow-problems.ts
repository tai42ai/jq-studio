/**
 * Derives the canvas's status from its nodes and edges: whether a Start anchor
 * and a logic node are present (reported to the host), the flow validator's
 * errored node ids (for the summary chip's cycle), the problem count that answers
 * "why is Save disabled", and whether any error holds. A failed conversion counts
 * as an error of its own, since the validator checks the graph, not the converter.
 * Frames the next errored node on demand.
 */
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { JQNodeType } from '../enums';
import type { JQNodeData } from '../types';
import { validateFlow } from '../utils/flow-validator';

interface FlowProblemsParams {
  nodes: Node<JQNodeData>[];
  edges: Edge[];
  conversionFailed: boolean;
  onHasErrorsChange?: (hasErrors: boolean) => void;
  onStartNodeChange?: (hasStart: boolean) => void;
  onHasLogicNodeChange?: (hasLogicNode: boolean) => void;
  instanceRef: RefObject<ReactFlowInstance<Node<JQNodeData>> | null>;
}

export interface FlowProblems {
  validationErrors: ReturnType<typeof validateFlow>;
  problemNodeIds: string[];
  problemCount: number;
  hasErrors: boolean;
  hasLogicNode: boolean;
  focusNextProblem: () => void;
}

export const useFlowProblems = ({
  nodes,
  edges,
  conversionFailed,
  onHasErrorsChange,
  onStartNodeChange,
  onHasLogicNodeChange,
  instanceRef,
}: FlowProblemsParams): FlowProblems => {
  const hasStartNode = useMemo(() => nodes.some((n) => n.type === JQNodeType.Start), [nodes]);
  // A logic node is any node that carries executable jq — everything but the Start
  // anchor and Comment annotations. A canvas with none is logic-less.
  const hasLogicNode = useMemo(
    () => nodes.some((n) => n.type !== JQNodeType.Start && n.type !== JQNodeType.Comment),
    [nodes],
  );

  useEffect(() => {
    onStartNodeChange?.(hasStartNode);
  }, [hasStartNode, onStartNodeChange]);
  useEffect(() => {
    onHasLogicNodeChange?.(hasLogicNode);
  }, [hasLogicNode, onHasLogicNodeChange]);

  const validationErrors = useMemo(() => validateFlow(nodes, edges), [nodes, edges]);

  // The node ids the validator flags with an error-severity problem, in node
  // order — the error-summary chip cycles through these.
  const problemNodeIds = useMemo(() => {
    const ids: string[] = [];
    for (const node of nodes) {
      const errs = validationErrors.get(node.id);
      if (errs?.some((e) => e.severity === 'error')) ids.push(node.id);
    }
    return ids;
  }, [nodes, validationErrors]);

  // A failed conversion is itself one problem, on top of every errored node — but a
  // still-EMPTY canvas is not a problem, it just has nothing to convert yet.
  const problemCount = problemNodeIds.length + (conversionFailed && nodes.length > 0 ? 1 : 0);

  const hasErrors = useMemo(() => {
    if (conversionFailed) return true;
    for (const errors of validationErrors.values()) {
      if (errors.some((e) => e.severity === 'error')) return true;
    }
    return false;
  }, [validationErrors, conversionFailed]);

  useEffect(() => {
    onHasErrorsChange?.(hasErrors);
  }, [hasErrors, onHasErrorsChange]);

  // Clicking the error-summary chip frames the next errored node (read-only — no
  // snapshot), cycling through them so an off-screen problem is findable.
  const problemCursor = useRef(0);
  const focusNextProblem = useCallback(() => {
    if (problemNodeIds.length === 0) return;
    const index = problemCursor.current % problemNodeIds.length;
    problemCursor.current = index + 1;
    const nodeId = problemNodeIds[index];
    if (!nodeId) return;
    void instanceRef.current
      ?.fitView({ nodes: [{ id: nodeId }], padding: 0.4, duration: 400 })
      .catch(() => undefined);
  }, [problemNodeIds, instanceRef]);

  return {
    validationErrors,
    problemNodeIds,
    problemCount,
    hasErrors,
    hasLogicNode,
    focusNextProblem,
  };
};
