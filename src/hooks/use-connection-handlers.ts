/**
 * The canvas's connection handlers. A drawn connection is admitted only when the
 * shared connection rules allow it; a jq target port is single-input, so a new
 * wire REPLACES any already on that exact slot, and a source handle fans out only
 * where the rules permit (the Start node's `functions` port). Connection start
 * records the drag origin so handles can glow as valid drop targets.
 */
import type {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
} from '@xyflow/react';
import { addEdge } from '@xyflow/react';
import type { Dispatch, DragEvent, SetStateAction } from 'react';
import { useCallback } from 'react';

import { useTransformerConnection } from '../TransformerContext';
import type { JQNodeData } from '../types';
import { allowsMultipleFromSource } from '../utils/connection-rules';
import { validateJQConnection } from '../utils/connection-validator';
import { dropEdgesOnTargetSlot } from '../utils/edge-slot';

interface ConnectionHandlerParams {
  nodes: Node<JQNodeData>[];
  edges: Edge[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  takeSnapshot: () => void;
}

export interface ConnectionHandlers {
  onConnect: OnConnect;
  onConnectStart: OnConnectStart;
  onConnectEnd: OnConnectEnd;
  onDragOver: (event: DragEvent) => void;
}

export const useConnectionHandlers = ({
  nodes,
  edges,
  setEdges,
  takeSnapshot,
}: ConnectionHandlerParams): ConnectionHandlers => {
  const { startConnection, endConnection } = useTransformerConnection();

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const isValid = validateJQConnection(
        sourceNode.data.type,
        targetNode.data.type,
        connection.sourceHandle ?? '',
        connection.targetHandle ?? '',
      );
      if (!isValid) return;

      // One connection per source handle, except handles the rules let fan out
      // (the Start node's "functions" handle grants every declared function).
      if (!allowsMultipleFromSource(sourceNode.data.type, connection.sourceHandle ?? null)) {
        const existingConnection = edges.find(
          (e) => e.source === connection.source && e.sourceHandle === connection.sourceHandle,
        );
        if (existingConnection) return;
      }

      takeSnapshot();

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'gradient',
            // Carry the two NODE TYPES (not baked colours); the edge renderer
            // resolves the gradient from the kind registry, so a colour is never
            // stale and the converter layer stays styling-free.
            data: {
              sourceType: sourceNode.data.type,
              targetType: targetNode.data.type,
              strokeWidth: 2,
            },
          },
          // A jq target port is single-input: REPLACE any wire already on this
          // exact slot rather than stacking a second the resolver would read
          // arbitrarily (e.g. two sources into one operator operand).
          dropEdgesOnTargetSlot(eds, connection.target, connection.targetHandle),
        ),
      );
    },
    [nodes, edges, setEdges, takeSnapshot],
  );

  const onConnectStart: OnConnectStart = useCallback(
    (_, { nodeId, handleId, handleType }) => {
      if (!nodeId) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      startConnection({
        sourceNodeId: nodeId,
        sourceNodeType: node.data.type,
        sourceHandleId: handleId ?? null,
        sourceHandleType: handleType ?? null,
        edges,
      });
    },
    [nodes, edges, startConnection],
  );

  const onConnectEnd: OnConnectEnd = useCallback(() => {
    endConnection();
  }, [endConnection]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return { onConnect, onConnectStart, onConnectEnd, onDragOver };
};
