/**
 * Placing new nodes on the canvas: drag-drop from the palette, click-to-add at
 * the viewport centre (registered on the shared context so the palette outside
 * the flow instance can trigger it), and adopting a graph loaded from the Load
 * dialog. Only FunctionDecl nodes get a default `func_decl_N` name; all others
 * start nameless.
 */
import type { Edge, Node, NodeChange, ReactFlowInstance } from '@xyflow/react';
import type { Dispatch, DragEvent, RefObject, SetStateAction } from 'react';
import { useCallback, useEffect } from 'react';

import { JQNodeType } from '../enums';
import { createDefaultNodeData, NODE_TYPE_LABELS } from '../nodes/node-factory';
import { useTransformerConnection } from '../TransformerContext';
import type { JQEdge, JQNode, JQNodeData } from '../types';

interface NodePlacementParams {
  setNodes: Dispatch<SetStateAction<Node<JQNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  takeSnapshot: () => void;
  handleNodesChange: (changes: NodeChange<Node<JQNodeData>>[]) => void;
  reactFlowWrapper: RefObject<HTMLDivElement | null>;
  instanceRef: RefObject<ReactFlowInstance<Node<JQNodeData>> | null>;
  nodeCountersRef: RefObject<Record<string, number>>;
  scheduleFit: () => void;
  readOnly: boolean | undefined;
}

export interface NodePlacement {
  onDrop: (event: DragEvent) => void;
  handleLoadExpression: (loadedNodes: JQNode[], loadedEdges: JQEdge[]) => void;
  onNodesDelete: () => void;
  handleNodeChanges: (changes: NodeChange<Node<JQNodeData>>[]) => void;
}

interface NodeCreationParams {
  setNodes: Dispatch<SetStateAction<Node<JQNodeData>[]>>;
  takeSnapshot: () => void;
  reactFlowWrapper: RefObject<HTMLDivElement | null>;
  instanceRef: RefObject<ReactFlowInstance<Node<JQNodeData>> | null>;
  nodeCountersRef: RefObject<Record<string, number>>;
  readOnly: boolean | undefined;
}

// Node creation: drag-drop from the palette and click-to-add at the viewport
// centre (registered on the shared context so the palette outside the flow
// instance can trigger it).
const useNodeCreation = ({
  setNodes,
  takeSnapshot,
  reactFlowWrapper,
  instanceRef,
  nodeCountersRef,
  readOnly,
}: NodeCreationParams): { onDrop: (event: DragEvent) => void } => {
  const { registerAddNode } = useTransformerConnection();

  // Place a new node of `type` at a flow-space position, selecting it (and
  // deselecting the rest). Shared by drag-drop and the palette's click-to-add.
  const placeNode = useCallback(
    (type: JQNodeType, position: { x: number; y: number }) => {
      takeSnapshot();

      let name: string | undefined;
      if (type === JQNodeType.FunctionDecl) {
        const label = NODE_TYPE_LABELS[type];
        nodeCountersRef.current[label] = (nodeCountersRef.current[label] ?? 0) + 1;
        name = `${label}_${String(nodeCountersRef.current[label])}`;
      }

      const newNode: Node<JQNodeData> = {
        id: `jq-${crypto.randomUUID()}`,
        type,
        position,
        selected: true,
        data: createDefaultNodeData(type, name),
      };

      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
    },
    [setNodes, takeSnapshot, nodeCountersRef],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const rawType = event.dataTransfer.getData('application/transformer-node-type');
      const instance = instanceRef.current;
      if (!rawType || !instance || !reactFlowWrapper.current) return;
      const type = rawType as JQNodeType;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = instance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      placeNode(type, position);
    },
    [instanceRef, reactFlowWrapper, placeNode],
  );

  // Click-to-add (and keyboard Enter/Space) from the palette: drop the node at
  // the viewport CENTRE.
  const addNodeAtCenter = useCallback(
    (type: JQNodeType) => {
      const instance = instanceRef.current;
      const wrapper = reactFlowWrapper.current;
      let position = { x: 0, y: 0 };
      if (instance && wrapper) {
        const bounds = wrapper.getBoundingClientRect();
        position = instance.screenToFlowPosition({ x: bounds.width / 2, y: bounds.height / 2 });
      }
      placeNode(type, position);
    },
    [placeNode, instanceRef, reactFlowWrapper],
  );

  useEffect(() => {
    if (readOnly) return;
    registerAddNode(addNodeAtCenter);
    return () => {
      registerAddNode(null);
    };
  }, [readOnly, registerAddNode, addNodeAtCenter]);

  return { onDrop };
};

export const useNodePlacement = ({
  setNodes,
  setEdges,
  takeSnapshot,
  handleNodesChange,
  reactFlowWrapper,
  instanceRef,
  nodeCountersRef,
  scheduleFit,
  readOnly,
}: NodePlacementParams): NodePlacement => {
  const { onDrop } = useNodeCreation({
    setNodes,
    takeSnapshot,
    reactFlowWrapper,
    instanceRef,
    nodeCountersRef,
    readOnly,
  });

  const handleLoadExpression = useCallback(
    (loadedNodes: JQNode[], loadedEdges: JQEdge[]) => {
      takeSnapshot();
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      nodeCountersRef.current = {};
      scheduleFit();
    },
    [setNodes, setEdges, scheduleFit, takeSnapshot, nodeCountersRef],
  );

  const onNodesDelete = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  // In readOnly mode only selection changes pass through (expand/collapse);
  // otherwise every change applies.
  const handleNodeChanges = useCallback(
    (changes: NodeChange<Node<JQNodeData>>[]) => {
      if (!readOnly) {
        handleNodesChange(changes);
        return;
      }
      const selectChanges = changes.filter((c) => c.type === 'select');
      if (selectChanges.length > 0) handleNodesChange(selectChanges);
    },
    [readOnly, handleNodesChange],
  );

  return { onDrop, handleLoadExpression, onNodesDelete, handleNodeChanges };
};
