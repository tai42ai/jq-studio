import { memo, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Position, useReactFlow } from '@xyflow/react';
import { Code2, Plus, X } from 'lucide-react';
import { JQNodeType, JQHandleIdPrefix, JQ_RESERVED_KEYWORDS, VALID_NAME_PATTERN } from '../enums';
import type { JQFunctionDeclData } from '../types';
import { useSnapshot } from '../SnapshotContext';
import { TransformerNode } from './TransformerNode';
import { NodeNameField } from './NodeNameField';
import { CollapsedHandles } from './CollapsedHandles';
import type { CollapsedHandleConfig } from './CollapsedHandles';
import { TransformerHandle } from './TransformerHandle';
import { getBuiltInFunctionNames } from '../utils/function-registry';
import { useTransformerReadOnly } from '../TransformerContext';
import { InfoTooltip, NodeLabel } from '../ui';
import { TextInput } from '../primitives';

type FunctionDeclNodeProps = NodeProps<Node<JQFunctionDeclData>>;

const errorInputStyle: CSSProperties = { borderColor: 'var(--jq-color-danger)' };

export const FunctionDeclNode = memo(({ id, data, selected }: FunctionDeclNodeProps) => {
  const { setNodes } = useReactFlow<Node<JQFunctionDeclData>>();
  const takeSnapshot = useSnapshot();
  const readOnly = useTransformerReadOnly();
  const parameters = data.parameters ?? [];

  const reservedNames = useMemo(() => [...getBuiltInFunctionNames(), ...JQ_RESERVED_KEYWORDS], []);

  const addParameter = useCallback(() => {
    takeSnapshot();
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          const currentParams = node.data.parameters ?? [];
          return {
            ...node,
            data: {
              ...node.data,
              parameters: [...currentParams, `param${String(currentParams.length + 1)}`],
            },
          };
        }
        return node;
      }),
    );
  }, [id, setNodes, takeSnapshot]);

  const removeParameter = useCallback(
    (index: number) => {
      takeSnapshot();
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            const currentParams = [...(node.data.parameters ?? [])];
            currentParams.splice(index, 1);
            return { ...node, data: { ...node.data, parameters: currentParams } };
          }
          return node;
        }),
      );
    },
    [id, setNodes, takeSnapshot],
  );

  const updateParameter = useCallback(
    (index: number, value: string) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            const currentParams = [...(node.data.parameters ?? [])];
            currentParams[index] = value;
            return { ...node, data: { ...node.data, parameters: currentParams } };
          }
          return node;
        }),
      );
    },
    [id, setNodes],
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
                {parameters.map((param, index) => {
                  const hasValue = param.length > 0;
                  const isValidName = !hasValue || VALID_NAME_PATTERN.test(param);
                  const isReserved = hasValue && reservedNames.includes(param);
                  const isDuplicate =
                    hasValue && parameters.some((p, i) => i !== index && p === param);
                  const hasError = hasValue && (!isValidName || isReserved || isDuplicate);

                  return (
                    <div key={index}>
                      <div className="jqs-jq-params__row">
                        <TextInput
                          value={param}
                          onChange={(e) => {
                            updateParameter(index, e.target.value);
                          }}
                          onFocus={() => {
                            takeSnapshot();
                          }}
                          readOnly={readOnly}
                          placeholder={`param${String(index + 1)}`}
                          style={hasError ? errorInputStyle : undefined}
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            className="jqs-jq-icon-btn jqs-jq-icon-btn--danger"
                            onClick={() => {
                              removeParameter(index);
                            }}
                            aria-label="Remove parameter"
                          >
                            <X className="jqs-jq-icon-sm" />
                          </button>
                        )}
                      </div>
                      {hasValue && !isValidName && (
                        <p className="jqs-jq-field__error">Invalid parameter name</p>
                      )}
                      {hasValue && isValidName && isReserved && (
                        <p className="jqs-jq-field__error">Reserved word</p>
                      )}
                      {hasValue && isValidName && !isReserved && isDuplicate && (
                        <p className="jqs-jq-field__error">Duplicate parameter name</p>
                      )}
                    </div>
                  );
                })}
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
