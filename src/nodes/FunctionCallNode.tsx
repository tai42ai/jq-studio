import type { Node, NodeProps } from '@xyflow/react';
import { Position, useEdges, useNodes, useReactFlow } from '@xyflow/react';
import { memo, useCallback, useMemo } from 'react';

import { JQHandleIdPrefix, JQNodeType } from '../enums';
import { JQ_KIND_REGISTRY } from '../jq-kind-registry';
import type { SelectOption } from '../primitives';
import { useSnapshot } from '../SnapshotContext';
import { useTransformerReadOnly } from '../TransformerContext';
import type { JQFunctionCallData, JQNodeData } from '../types';
import type { FunctionParam } from '../utils/function-catalog';
import { functionCategories } from '../utils/function-catalog';
import { getFunctionOptions, resolveFunctionDef, visibleParams } from '../utils/function-resolver';
import { customFunctionDefs } from '../utils/graph-scope';
import type { CollapsedHandleConfig } from './CollapsedHandles';
import { CollapsedHandles } from './CollapsedHandles';
import { FunctionCallForm } from './function-call/FunctionCallForm';
import { TransformerNode } from './TransformerNode';
import { useNodeConnectionState } from './useNodeConnectionState';

type FunctionCallNodeProps = NodeProps<Node<JQFunctionCallData>>;

const allCallTypeOptions: SelectOption[] = [
  ...functionCategories.map((c) => ({ value: c.id, label: c.label })),
  { value: 'custom', label: 'Custom Functions' },
];

interface CollapsedHandleContext {
  id: string;
  params: FunctionParam[];
  isChildNode: boolean;
  hasOperatorConnection: boolean;
  hasTopConnection: boolean;
}

/** The source handles a collapsed FunctionCall card exposes: the data-source
 *  root, the operator operands (when it can be an operand), and one ORDER-BEARING
 *  dot per positional param — labelled by parameter name when one is known. */
const buildCollapsedHandles = ({
  id,
  params,
  isChildNode,
  hasOperatorConnection,
  hasTopConnection,
}: CollapsedHandleContext): CollapsedHandleConfig[] => {
  const handles: CollapsedHandleConfig[] = [
    {
      id: `${JQHandleIdPrefix.Root}:${id}`,
      position: Position.Left,
      type: 'source',
      handleType: 'source',
    },
  ];
  if (!isChildNode || hasOperatorConnection) {
    if (!hasTopConnection) {
      handles.push({
        id: `${JQHandleIdPrefix.OperatorLeft}:${id}`,
        position: Position.Left,
        type: 'source',
        handleType: 'source',
      });
    }
    handles.push({
      id: `${JQHandleIdPrefix.OperatorRight}:${id}`,
      position: Position.Right,
      type: 'source',
      handleType: 'source',
    });
  }
  for (let i = 0; i < params.length; i++) {
    const paramName = params[i]?.name;
    handles.push({
      id: `${JQHandleIdPrefix.Param}:${String(i)}`,
      position: Position.Right,
      type: 'source',
      handleType: 'source',
      label: paramName && paramName.length > 0 ? paramName : undefined,
    });
  }
  return handles;
};

export const FunctionCallNode = memo(({ id, data, selected }: FunctionCallNodeProps) => {
  const { setNodes } = useReactFlow<Node<JQNodeData>>();
  const takeSnapshot = useSnapshot();
  const readOnly = useTransformerReadOnly();
  const { isChildNode, hasTopConnection, hasOperatorConnection, hasBottomConnection, isChainNode } =
    useNodeConnectionState(id);
  const allNodes = useNodes<Node<JQNodeData>>();
  const allEdges = useEdges();

  const customFunctions = useMemo(
    () => customFunctionDefs(allNodes, allEdges),
    [allNodes, allEdges],
  );

  const functionOptions = useMemo(
    () => getFunctionOptions(data.callType, customFunctions),
    [data.callType, customFunctions],
  );

  // The call's ARITY: how many positional args are wired to it. Multi-arity
  // builtins (range, recurse, combinations) register one def per overload keyed
  // by an arity-suffixed id, while the converter stores the bare NAME — so the
  // def can only be resolved by name + this arity (see `resolveFunctionDef`).
  const arity = useMemo(
    () =>
      allEdges.filter(
        (e) => e.source === id && (e.sourceHandle ?? '').startsWith(`${JQHandleIdPrefix.Param}:`),
      ).length,
    [allEdges, id],
  );

  const functionDef = useMemo(
    () => resolveFunctionDef(functionOptions, data.selectedFunction, arity),
    [functionOptions, data.selectedFunction, arity],
  );

  const functionSelectOptions: SelectOption[] = useMemo(
    () => functionOptions.map((fn) => ({ value: fn.id, label: fn.name })),
    [functionOptions],
  );

  const updateData = useCallback(
    (updates: Partial<JQFunctionCallData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...(updates as JQFunctionCallData) } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  const onCallTypeChange = useCallback(
    (value: string) => {
      takeSnapshot();
      updateData({ callType: value, selectedFunction: undefined });
    },
    [updateData, takeSnapshot],
  );

  const onFunctionChange = useCallback(
    (value: string) => {
      takeSnapshot();
      updateData({ selectedFunction: value });
    },
    [updateData, takeSnapshot],
  );

  // Render a port per VISIBLE param: required params always, trailing optional
  // params only once the arity reaches them (a bare `first` shows zero ports).
  const params: FunctionParam[] = useMemo(
    () => visibleParams(functionDef, arity),
    [functionDef, arity],
  );
  const collapsed = !selected;

  const collapsedHandles = useMemo(
    () =>
      buildCollapsedHandles({ id, params, isChildNode, hasOperatorConnection, hasTopConnection }),
    [id, params, isChildNode, hasOperatorConnection, hasTopConnection],
  );

  return (
    <TransformerNode
      id={id}
      nodeType={JQNodeType.FunctionCall}
      title={JQ_KIND_REGISTRY[JQNodeType.FunctionCall].builderCaption}
      icon={(() => {
        const Icon = JQ_KIND_REGISTRY[JQNodeType.FunctionCall].icon;
        return <Icon className="jqs-jq-icon" />;
      })()}
      selected={selected}
      collapsed={collapsed}
      summary={data.selectedFunction ?? ''}
      hasTargetHandle={!isChainNode}
      hasSourceHandle={!isChildNode || hasBottomConnection}
    >
      {collapsed ? (
        <CollapsedHandles
          nodeId={id}
          nodeType={JQNodeType.FunctionCall}
          handles={collapsedHandles}
        />
      ) : (
        <FunctionCallForm
          id={id}
          data={data}
          readOnly={readOnly}
          isChildNode={isChildNode}
          hasOperatorConnection={hasOperatorConnection}
          hasTopConnection={hasTopConnection}
          isChainNode={isChainNode}
          callTypeOptions={allCallTypeOptions}
          functionSelectOptions={functionSelectOptions}
          functionDef={functionDef}
          params={params}
          onCallTypeChange={onCallTypeChange}
          onFunctionChange={onFunctionChange}
        />
      )}
    </TransformerNode>
  );
});

FunctionCallNode.displayName = 'FunctionCallNode';
