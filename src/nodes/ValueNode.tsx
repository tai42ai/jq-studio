import type { Node, NodeProps } from '@xyflow/react';
import { Position, useReactFlow } from '@xyflow/react';
import { Hash } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

import { JQHandleIdPrefix, JQNodeType, ValueType } from '../enums';
import type { SelectOption } from '../primitives';
import { Select } from '../primitives';
import { useSnapshot } from '../SnapshotContext';
import { useTransformerReadOnly } from '../TransformerContext';
import type { JQNodeData, JQValueData } from '../types';
import { NodeLabel } from '../ui';
import type { CollapsedHandleConfig } from './CollapsedHandles';
import { CollapsedHandles } from './CollapsedHandles';
import { NodeNameField } from './NodeNameField';
import { OperatorHandles } from './OperatorHandles';
import { TransformerNode } from './TransformerNode';
import { useNodeConnectionState } from './useNodeConnectionState';
import { getValueSummary, valueTypeBase } from './value/value-data';
import { ValueInput } from './value/ValueInput';

type ValueNodeProps = NodeProps<Node<JQValueData>>;

const valueTypeOptions: SelectOption[] = Object.values(ValueType).map((vt) => ({
  value: vt,
  label: vt.charAt(0).toUpperCase() + vt.slice(1),
}));

export const ValueNode = memo(({ id, data, selected }: ValueNodeProps) => {
  const { setNodes } = useReactFlow<Node<JQNodeData>>();
  const takeSnapshot = useSnapshot();
  const readOnly = useTransformerReadOnly();
  const { isChildNode, hasTopConnection, hasBottomConnection, hasOperatorConnection, isChainNode } =
    useNodeConnectionState(id);

  const updateData = useCallback(
    (updates: Partial<JQValueData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...(updates as JQValueData) } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  const onTypeChange = useCallback(
    (value: string) => {
      takeSnapshot();
      updateData(valueTypeBase(value as ValueType));
    },
    [updateData, takeSnapshot],
  );

  const collapsed = !selected;

  // A string literal's own text is bidi-ISOLATED (`<bdi>`) so an RTL value never
  // reorders the surrounding quotes — `"مرحبا"` keeps its quotes on the outside.
  const summaryNode =
    data.valueType === ValueType.String ? (
      <>
        &quot;<bdi>{String(data.value ?? '')}</bdi>&quot;
      </>
    ) : (
      getValueSummary(data)
    );

  const collapsedHandles = useMemo((): CollapsedHandleConfig[] => {
    const handles: CollapsedHandleConfig[] = [];
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
    // Array item / object field ports are ORDER- and KEY-bearing but their id is
    // an opaque uuid, so the role can only be named by the node: give each item
    // its 0-based `[i]` index and each field its key text as a node-supplied
    // collapsed label, so a wire's destination slot is glanceable without
    // expanding the card. An unnamed key stays bare rather than showing noise.
    (data.items ?? []).forEach((item, index) => {
      handles.push({
        id: `${JQHandleIdPrefix.Item}:${item.id}`,
        position: Position.Right,
        type: 'source',
        handleType: 'source',
        label: `[${String(index)}]`,
      });
    });
    for (const field of data.fields ?? []) {
      handles.push({
        id: `${JQHandleIdPrefix.Field}:${field.id}`,
        position: Position.Right,
        type: 'source',
        handleType: 'source',
        label: field.name || undefined,
      });
    }
    return handles;
  }, [id, data.items, data.fields, isChildNode, hasOperatorConnection, hasTopConnection]);

  return (
    <TransformerNode
      id={id}
      nodeType={JQNodeType.Value}
      title="Value"
      icon={<Hash className="jqs-jq-icon" />}
      selected={selected}
      collapsed={collapsed}
      summary={summaryNode}
      hasTargetHandle={!isChainNode}
      hasSourceHandle={!isChildNode || hasBottomConnection}
    >
      {collapsed ? (
        <CollapsedHandles nodeId={id} nodeType={JQNodeType.Value} handles={collapsedHandles} />
      ) : (
        <>
          {(!isChildNode || hasOperatorConnection) && (
            <OperatorHandles
              nodeId={id}
              nodeType={JQNodeType.Value}
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
                value={data.valueType}
                onValueChange={onTypeChange}
                disabled={readOnly}
                placeholder="Select type"
                aria-label="Value type"
                options={valueTypeOptions}
              />
            </div>

            <div className="jqs-jq-field">
              <NodeLabel>Value</NodeLabel>
              <ValueInput
                nodeId={id}
                data={data}
                readOnly={readOnly}
                updateData={updateData}
                takeSnapshot={takeSnapshot}
              />
            </div>
          </div>
        </>
      )}
    </TransformerNode>
  );
});

ValueNode.displayName = 'ValueNode';
