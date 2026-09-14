/**
 * Regenerates the jq expression from the graph and emits it through `onChange`
 * once the initial load has settled. A conversion that throws yields its message
 * as the expression (so the canvas shows what broke) and marks it a placeholder
 * rather than jq; the pre-settle empty-graph placeholder is suppressed so it is
 * never captured as the dialog's dirty baseline.
 */
import { useEffect, useMemo } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { JQNodeData } from '../types';
import { convertFlowToJQ } from '../utils/converters/jq-from-flow';

export interface FlowExpression {
  expression: string;
  conversionFailed: boolean;
}

export const useFlowExpression = (
  nodes: Node<JQNodeData>[],
  edges: Edge[],
  onChange: ((expression: string) => void) | undefined,
  initialLoadSettled: boolean,
): FlowExpression => {
  const { expression, conversionFailed } = useMemo(() => {
    try {
      return { expression: convertFlowToJQ(nodes, edges), conversionFailed: false };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during conversion';
      console.error('[TransformerCanvas] Error converting flow to jq:', errorMsg);
      return { expression: `# Error: ${errorMsg}`, conversionFailed: true };
    }
  }, [nodes, edges]);

  useEffect(() => {
    if (!initialLoadSettled) return;
    onChange?.(expression);
  }, [expression, onChange, initialLoadSettled]);

  return { expression, conversionFailed };
};
