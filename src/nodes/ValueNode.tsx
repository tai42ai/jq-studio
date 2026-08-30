import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Position, useReactFlow } from '@xyflow/react';
import { Hash, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Select, TextInput } from '../primitives';
import type { SelectOption } from '../primitives';
import { NodeNameField } from './NodeNameField';
import { TransformerNode } from './TransformerNode';
import { OperatorHandles } from './OperatorHandles';
import { TransformerHandle } from './TransformerHandle';
import { CollapsedHandles } from './CollapsedHandles';
import type { CollapsedHandleConfig } from './CollapsedHandles';
import { useNodeConnectionState } from './useNodeConnectionState';
import { PathSelector } from './PathSelector';
import { compilePathSegments } from '../utils/path-segments';
import { JQNodeType, JQHandleIdPrefix, ValueType } from '../enums';
import type {
  JQValueData,
  JQNodeData,
  ValueArrayItem,
  ValueObjectField,
  PathSegment,
} from '../types';
import { useSnapshot } from '../SnapshotContext';
import { useTransformerReadOnly } from '../TransformerContext';
import { NodeLabel } from '../ui';

type ValueNodeProps = NodeProps<Node<JQValueData>>;

const valueTypeOptions: SelectOption[] = Object.values(ValueType).map((vt) => ({
  value: vt,
  label: vt.charAt(0).toUpperCase() + vt.slice(1),
}));

const nextItemId = () => crypto.randomUUID();

/**
 * Numeric value input that keeps the RAW typed string in local state and commits
 * only a finite parse, so an empty or partial entry never writes 0/NaN to the node.
 */
const NumberValueInput = ({
  value,
  readOnly,
  onCommit,
  onFocus,
}: {
  value: number;
  readOnly: boolean;
  onCommit: (n: number) => void;
  onFocus?: () => void;
}) => {
  const [text, setText] = useState(() => String(value));

  // Follow the stored number when it changes from outside this input (type
  // switch, undo/redo) without overwriting a partial entry the user is typing.
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextInput
      type="number"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = Number(raw);
        if (raw.trim() !== '' && Number.isFinite(parsed)) onCommit(parsed);
      }}
      onFocus={onFocus}
      readOnly={readOnly}
      placeholder="Enter number"
    />
  );
};

const getValueSummary = (data: JQValueData): string => {
  switch (data.valueType) {
    case ValueType.Array:
      return '[]';
    case ValueType.Object:
      return '{}';
    case ValueType.Path:
      return data.pathValue ?? '.';
    case ValueType.Null:
      return 'null';
    case ValueType.Boolean:
      return String(data.value ?? false);
    case ValueType.Number:
      return String(data.value ?? 0);
    case ValueType.String:
      return data.value !== undefined ? `"${String(data.value)}"` : '""';
    default:
      return '';
  }
};

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
      const vt = value as ValueType;
      const base: Partial<JQValueData> = {
        valueType: vt,
        value: undefined,
        items: undefined,
        fields: undefined,
        pathValue: undefined,
      };
      switch (vt) {
        case ValueType.String:
          base.value = '';
          break;
        case ValueType.Number:
          base.value = 0;
          break;
        case ValueType.Boolean:
          base.value = false;
          break;
        case ValueType.Array:
          base.items = [];
          break;
        case ValueType.Object:
          base.fields = [];
          break;
        case ValueType.Null:
          base.value = null;
          break;
      }
      updateData(base);
    },
    [updateData, takeSnapshot],
  );

  const addItem = useCallback(() => {
    takeSnapshot();
    const newItem: ValueArrayItem = { id: nextItemId() };
    updateData({ items: [...(data.items ?? []), newItem] });
  }, [data.items, updateData, takeSnapshot]);

  const removeItem = useCallback(
    (itemId: string) => {
      takeSnapshot();
      updateData({ items: (data.items ?? []).filter((i) => i.id !== itemId) });
    },
    [data.items, updateData, takeSnapshot],
  );

  const addField = useCallback(() => {
    takeSnapshot();
    const newField: ValueObjectField = { id: nextItemId(), name: '' };
    updateData({ fields: [...(data.fields ?? []), newField] });
  }, [data.fields, updateData, takeSnapshot]);

  const removeField = useCallback(
    (fieldId: string) => {
      takeSnapshot();
      updateData({ fields: (data.fields ?? []).filter((f) => f.id !== fieldId) });
    },
    [data.fields, updateData, takeSnapshot],
  );

  const updateFieldName = useCallback(
    (fieldId: string, name: string) => {
      updateData({
        fields: (data.fields ?? []).map((f) => (f.id === fieldId ? { ...f, name } : f)),
      });
    },
    [data.fields, updateData],
  );

  const renderValueInput = () => {
    switch (data.valueType) {
      case ValueType.String:
        return (
          <TextInput
            value={(data.value ?? '') as string}
            onChange={(e) => {
              updateData({ value: e.target.value });
            }}
            // Snapshot the pre-edit state on focus so a value edit is undoable
            // (free-text idiom; a node click no longer snapshots).
            onFocus={() => {
              takeSnapshot();
            }}
            readOnly={readOnly}
            placeholder="Enter text"
          />
        );
      case ValueType.Number:
        return (
          <NumberValueInput
            value={typeof data.value === 'number' ? data.value : 0}
            readOnly={readOnly}
            onCommit={(n) => {
              updateData({ value: n });
            }}
            onFocus={() => {
              takeSnapshot();
            }}
          />
        );
      case ValueType.Boolean:
        return (
          <Checkbox
            checked={!!data.value}
            onCheckedChange={(checked) => {
              updateData({ value: checked });
            }}
            disabled={readOnly}
            label={data.value ? 'true' : 'false'}
          />
        );
      case ValueType.Array:
        return (
          <div className="jqs-jq-collection">
            {(data.items ?? []).map((item, index) => (
              <div key={item.id} className="jqs-jq-collection__row">
                <span className="jqs-jq-row__label">[{index}]</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      removeItem(item.id);
                    }}
                    className="jqs-jq-icon-btn"
                    aria-label="Remove item"
                  >
                    <Trash2 className="jqs-jq-icon-sm" />
                  </button>
                )}
                <div className="jqs-jq-collection__handle">
                  <TransformerHandle
                    nodeId={id}
                    nodeType={JQNodeType.Value}
                    position={Position.Right}
                    type="source"
                    handleType="source"
                    id={`${JQHandleIdPrefix.Item}:${item.id}`}
                    label=""
                  />
                </div>
              </div>
            ))}
            {!readOnly && (
              <Button onClick={addItem} style={{ width: '100%', justifyContent: 'center' }}>
                <Plus className="jqs-jq-icon-sm" /> Add Item
              </Button>
            )}
          </div>
        );
      case ValueType.Object:
        return (
          <div className="jqs-jq-collection">
            {(data.fields ?? []).map((field) => (
              <div key={field.id} className="jqs-jq-collection__row">
                <TextInput
                  value={field.name}
                  onChange={(e) => {
                    updateFieldName(field.id, e.target.value);
                  }}
                  onFocus={() => {
                    takeSnapshot();
                  }}
                  readOnly={readOnly}
                  placeholder="key"
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      removeField(field.id);
                    }}
                    className="jqs-jq-icon-btn"
                    aria-label="Remove field"
                  >
                    <Trash2 className="jqs-jq-icon-sm" />
                  </button>
                )}
                <div className="jqs-jq-collection__handle">
                  <TransformerHandle
                    nodeId={id}
                    nodeType={JQNodeType.Value}
                    position={Position.Right}
                    type="source"
                    handleType="source"
                    id={`${JQHandleIdPrefix.Field}:${field.id}`}
                    label=""
                  />
                </div>
              </div>
            ))}
            {!readOnly && (
              <Button onClick={addField} style={{ width: '100%', justifyContent: 'center' }}>
                <Plus className="jqs-jq-icon-sm" /> Add Field
              </Button>
            )}
          </div>
        );
      case ValueType.Path:
        return (
          <PathSelector
            nodeId={id}
            segments={data.pathSegments ?? [{ id: 'seg_root', type: 'root', value: '.' }]}
            onSegmentsChange={(segments: PathSegment[]) => {
              updateData({
                pathSegments: segments,
                pathValue: compilePathSegments(segments),
              });
            }}
          />
        );
      case ValueType.Null:
        return <span className="jqs-jq-null">null</span>;
      default:
        return null;
    }
  };

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
              {renderValueInput()}
            </div>
          </div>
        </>
      )}
    </TransformerNode>
  );
});

ValueNode.displayName = 'ValueNode';
