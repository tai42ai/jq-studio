/**
 * Enriches edges with their two node TYPES from the live nodes, so the renderer
 * always paints a current gradient — and converter-built edges, which carry no
 * colours, pick up their gradient here too.
 */
import type { Edge, Node } from '@xyflow/react';
import { useMemo } from 'react';

import type { JQNodeType } from '../enums';
import { isJqNodeType } from '../enums';
import type { JQNodeData } from '../types';

export const useEdgeGradients = (nodes: Node<JQNodeData>[], edges: Edge[]): Edge[] => {
  const nodeTypeById = useMemo(() => {
    const map = new Map<string, JQNodeType>();
    for (const node of nodes) {
      if (isJqNodeType(node.type)) map.set(node.id, node.type);
    }
    return map;
  }, [nodes]);

  return useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          sourceType: nodeTypeById.get(edge.source),
          targetType: nodeTypeById.get(edge.target),
        },
      })),
    [edges, nodeTypeById],
  );
};
