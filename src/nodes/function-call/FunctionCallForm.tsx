import { memo } from 'react';
import { Position } from '@xyflow/react';
import { Select } from '../../primitives';
import type { SelectOption } from '../../primitives';
import { JQNodeType, JQHandleIdPrefix } from '../../enums';
import type { JQFunctionCallData } from '../../types';
import type { FunctionDef, FunctionParam } from '../../utils/function-catalog';
import { TransformerHandle } from '../TransformerHandle';
import { NodeNameField } from '../NodeNameField';
import { OperatorHandles } from '../OperatorHandles';
import { InfoTooltip, NodeLabel } from '../../ui';

interface FunctionCallFormProps {
  id: string;
  data: JQFunctionCallData;
  readOnly: boolean;
  isChildNode: boolean;
  hasOperatorConnection: boolean;
  hasTopConnection: boolean;
  isChainNode: boolean;
  callTypeOptions: SelectOption[];
  functionSelectOptions: SelectOption[];
  functionDef: FunctionDef | null;
  params: FunctionParam[];
  onCallTypeChange: (value: string) => void;
  onFunctionChange: (value: string) => void;
}

/** The expanded FunctionCall editor: name, call type + function selects, the
 *  optional data-source input handle, and one port per visible parameter. */
export const FunctionCallForm = memo(
  ({
    id,
    data,
    readOnly,
    isChildNode,
    hasOperatorConnection,
    hasTopConnection,
    isChainNode,
    callTypeOptions,
    functionSelectOptions,
    functionDef,
    params,
    onCallTypeChange,
    onFunctionChange,
  }: FunctionCallFormProps) => (
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
            options={callTypeOptions}
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
  ),
);

FunctionCallForm.displayName = 'FunctionCallForm';
