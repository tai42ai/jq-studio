import { memo, useMemo, useCallback } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Position, useReactFlow, useNodes, useEdges } from '@xyflow/react';
import { Select } from '../primitives';
import type { SelectOption } from '../primitives';
import { JQNodeType, JQHandleIdPrefix } from '../enums';
import { JQ_KIND_REGISTRY } from '../jq-kind-registry';
import type { JQFunctionCallData, JQFunctionDeclData, JQNodeData } from '../types';
import { useSnapshot } from '../SnapshotContext';
import { TransformerNode } from './TransformerNode';
import { TransformerHandle } from './TransformerHandle';
import { NodeNameField } from './NodeNameField';
import { OperatorHandles } from './OperatorHandles';
import { functionCategories, resolveFunctionDef, visibleParams } from '../utils/function-registry';
import type { FunctionDef, FunctionParam } from '../utils/function-registry';
import { CollapsedHandles } from './CollapsedHandles';
import type { CollapsedHandleConfig } from './CollapsedHandles';
import { useNodeConnectionState } from './useNodeConnectionState';
import { useTransformerReadOnly } from '../TransformerContext';
import { InfoTooltip, NodeLabel } from '../ui';

type FunctionCallNodeProps = NodeProps<Node<JQFunctionCallData>>;

const allCallTypeOptions: SelectOption[] = [
  ...functionCategories.map((c) => ({ value: c.id, label: c.label })),
  { value: 'custom', label: 'Custom Functions' },
];

const useCustomFunctions = (): FunctionDef[] => {
  const allNodes = useNodes<Node<JQNodeData>>();
  const allEdges = useEdges();

  return useMemo(() => {
    const startNode = allNodes.find((n) => n.type === JQNodeType.Start);
    if (!startNode) return [];

    const funcEdges = allEdges.filter(
      (e) => e.source === startNode.id && e.sourceHandle === JQHandleIdPrefix.Functions,
    );

    return funcEdges
      .map((e) => allNodes.find((n) => n.id === e.target))
      .filter(
        (n): n is Node<JQFunctionDeclData> =>
          n?.data.type === JQNodeType.FunctionDecl && !!n.data.name,
      )
      .map((n) => {
        const fnName = n.data.name ?? '';
        return {
          id: fnName,
          name: fnName,
          description: `Custom function: ${fnName}`,
          params: (n.data.parameters ?? []).map((p) => ({
            name: p,
            description: `Parameter: ${p}`,
          })),
        };
      });
  }, [allNodes, allEdges]);
};

/**
 * Resolves the selectable functions for a call type.
 *
 * Valid call types are `'custom'` — the flow's own `def` declarations — and the
 * ids in `functionCategories`.
 *
 * @throws {Error} If the call type is not one of those values.
 */
const getFunctionOptions = (callType: string, customFunctions: FunctionDef[]): FunctionDef[] => {
  if (callType === 'custom') return customFunctions;
  const category = functionCategories.find((c) => c.id === callType);
  if (!category) {
    const valid = [...functionCategories.map((c) => c.id), 'custom'].join(', ');
    throw new Error(`Unknown function call type "${callType}". Valid call types: ${valid}.`);
  }
  return category.functions;
};

export const FunctionCallNode = memo(({ id, data, selected }: FunctionCallNodeProps) => {
  const { setNodes } = useReactFlow<Node<JQNodeData>>();
  const takeSnapshot = useSnapshot();
  const readOnly = useTransformerReadOnly();
  const { isChildNode, hasTopConnection, hasOperatorConnection, hasBottomConnection, isChainNode } =
    useNodeConnectionState(id);
  const customFunctions = useCustomFunctions();
  const allEdges = useEdges();

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

  const collapsedHandles = useMemo((): CollapsedHandleConfig[] => {
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
    // Positional args are ORDER-BEARING: on a collapsed card the param dots are
    // otherwise identical. Label each with its real parameter name when the
    // function definition supplies one (names beat ordinals); `jqPortLabel`
    // supplies the `arg 1..n` ordinal fallback for an unnamed slot.
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
  }, [id, params, isChildNode, hasOperatorConnection, hasTopConnection]);

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
        <>
          {(!isChildNode || hasOperatorConnection) && (
            <OperatorHandles
              nodeId={id}
              nodeType={JQNodeType.FunctionCall}
              showLeftHandle={!hasTopConnection}
            />
          )}

          <div className="jqs-jq-stack">
            {!isChainNode && !isChildNode && (
              <NodeNameField
                id={id}
                name={data.name}
                pipeAfterDeclare={data.pipeAfterDeclare ?? false}
              />
            )}

            <div className="jqs-jq-field">
              <NodeLabel>Type</NodeLabel>
              <Select
                value={data.callType}
                onValueChange={onCallTypeChange}
                disabled={readOnly}
                placeholder="Select type"
                aria-label="Call type"
                options={allCallTypeOptions}
              />
            </div>

            <div className="jqs-jq-field">
              <NodeLabel>Function</NodeLabel>
              <Select
                value={data.selectedFunction ?? ''}
                onValueChange={onFunctionChange}
                disabled={readOnly}
                placeholder="Select function"
                aria-label="Function"
                options={functionSelectOptions}
              />
            </div>

            {functionDef && <p className="jqs-jq-muted-italic">{functionDef.description}</p>}

            <div className="jqs-jq-field">
              <div className="jqs-jq-field__label-row">
                <NodeLabel>Input (optional)</NodeLabel>
                <InfoTooltip text="Connect a value to override the default pipe input (prev node) as the function's data source." />
              </div>
              <div className="jqs-jq-row jqs-jq-row--source">
                <span className="jqs-jq-row__label">Data source</span>
                <div className="jqs-jq-row__handle jqs-jq-row__handle--left">
                  <TransformerHandle
                    nodeId={id}
                    nodeType={JQNodeType.FunctionCall}
                    position={Position.Left}
                    type="source"
                    handleType="source"
                    id={`${JQHandleIdPrefix.Root}:${id}`}
                    label=""
                  />
                </div>
              </div>
            </div>

            {params.length > 0 && (
              <div className="jqs-jq-field">
                <NodeLabel>Parameters</NodeLabel>
                {params.map((param, index) => (
                  <div key={param.name} className="jqs-jq-row jqs-jq-row--param">
                    <span className="jqs-jq-row__label jqs-jq-row__label--inline">
                      {param.name}
                      <InfoTooltip text={param.description} />
                    </span>
                    <div className="jqs-jq-row__handle jqs-jq-row__handle--right">
                      <TransformerHandle
                        nodeId={id}
                        nodeType={JQNodeType.FunctionCall}
                        position={Position.Right}
                        type="source"
                        handleType="source"
                        id={`${JQHandleIdPrefix.Param}:${String(index)}`}
                        label=""
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </TransformerNode>
  );
});

FunctionCallNode.displayName = 'FunctionCallNode';
