import type { Node, NodeProps } from '@xyflow/react';
import { Position, useReactFlow } from '@xyflow/react';
import { Code2, Plus } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

import { JQHandleIdPrefix, JQNodeType } from '../enums';
import { useSnapshot } from '../SnapshotContext';
import { useTransformerReadOnly } from '../TransformerContext';
import type { JQFunctionDeclData } from '../types';
import { InfoTooltip, NodeLabel } from '../ui';
import { buildReservedNames } from '../utils/name-validation';
import type { CollapsedHandleConfig } from './CollapsedHandles';
import { CollapsedHandles } from './CollapsedHandles';
import { appendParam, removeParamAt, setParamAt } from './function-decl/function-decl-data';
import { FunctionParamRow } from './function-decl/FunctionParamRow';
import { NodeNameField } from './NodeNameField';
import { TransformerHandle } from './TransformerHandle';
import { TransformerNode } from './TransformerNode';

type FunctionDeclNodeProps = NodeProps<Node<JQFunctionDeclData>>;

export const FunctionDeclNode = memo(({ id, data, selected }: FunctionDeclNodeProps) => {
  const { setNodes } = useReactFlow<Node<JQFunctionDeclData>>();
  const takeSnapshot = useSnapshot();
  const readOnly = useTransformerReadOnly();
  const parameters = data.parameters ?? [];

  const reservedNames = useMemo(() => buildReservedNames(), []);

  const mutateParams = useCallback(
    (reduce: (params: string[]) => string[]) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, parameters: reduce(node.data.parameters ?? []) } }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const addParameter = useCallback(() => {
    takeSnapshot();
    mutateParams(appendParam);
  }, [mutateParams, takeSnapshot]);

  const removeParameter = useCallback(
    (index: number) => {
      takeSnapshot();
      mutateParams((params) => removeParamAt(params, index));
    },
    [mutateParams, takeSnapshot],
  );

  const updateParameter = useCallback(
    (index: number, value: string) => {
      mutateParams((params) => setParamAt(params, index, value));
    },
    [mutateParams],
  );

  const collapsed = !selected;

  const collapsedHandles: CollapsedHandleConfig[] = useMemo(
    () => [
      {
        id: `${JQHandleIdPrefix.Logic}:${id}:expression`,
        position: Position.Right,
        type: 'source',
        handleType: 'source',
      },
    ],
    [id],
  );

  return (
    <TransformerNode
      id={id}
      nodeType={JQNodeType.FunctionDecl}
      title="Define Function"
      icon={<Code2 className="jqs-jq-icon" />}
      selected={selected}
      collapsed={collapsed}
      summary={data.name ?? ''}
      hasTargetHandle={true}
      hasSourceHandle={false}
    >
      {collapsed ? (
        <CollapsedHandles
          nodeId={id}
          nodeType={JQNodeType.FunctionDecl}
          handles={collapsedHandles}
        />
      ) : (
        <>
          <NodeNameField
            id={id}
            name={data.name}
            reservedNames={reservedNames}
            required
            label="Function Name"
            tooltip="The function name used to call it across the flow"
            placeholder="my_function"
          />

          <div className="jqs-jq-field">
            <div className="jqs-jq-field__label-row jqs-jq-field__label-row--spread">
              <div className="jqs-jq-field__label-row">
                <NodeLabel>Parameters</NodeLabel>
                <InfoTooltip text="Parameters are filter arguments referenced by name inside the function body." />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="jqs-jq-icon-btn"
                  onClick={addParameter}
                  aria-label="Add parameter"
                >
                  <Plus className="jqs-jq-icon-sm" />
                </button>
              )}
            </div>

            {parameters.length === 0 ? (
              <p className="jqs-jq-muted-italic">No parameters</p>
            ) : (
              <div className="jqs-jq-params">
                {parameters.map((param, index) => (
                  <FunctionParamRow
                    key={index}
                    index={index}
                    param={param}
                    siblingParams={parameters.filter((_, i) => i !== index)}
                    reservedNames={reservedNames}
                    readOnly={readOnly}
                    onChange={updateParameter}
                    onFocus={takeSnapshot}
                    onRemove={removeParameter}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="jqs-jq-logic-row">
            <NodeLabel>Body</NodeLabel>
            <div className="jqs-jq-logic-row__handle">
              <TransformerHandle
                nodeId={id}
                nodeType={JQNodeType.FunctionDecl}
                position={Position.Right}
                type="source"
                handleType="source"
                isInner={true}
                id={`${JQHandleIdPrefix.Logic}:${id}:expression`}
              />
            </div>
          </div>
        </>
      )}
    </TransformerNode>
  );
});

FunctionDeclNode.displayName = 'FunctionDeclNode';
