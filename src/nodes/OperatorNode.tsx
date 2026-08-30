import { memo, useCallback, useMemo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Position, useReactFlow } from '@xyflow/react';
import { Calculator } from 'lucide-react';
import { Select } from '../primitives';
import type { SelectGroup } from '../primitives';
import { JQNodeType, JQHandleIdPrefix } from '../enums';
import type { JQOperatorData, JQNodeData } from '../types';
import { OPERATOR_CATALOG } from '../operator-catalog';
import { useSnapshot } from '../SnapshotContext';
import { TransformerNode } from './TransformerNode';
import { TransformerHandle } from './TransformerHandle';
import { CollapsedHandles } from './CollapsedHandles';
import type { CollapsedHandleConfig } from './CollapsedHandles';
import { useTransformerReadOnly } from '../TransformerContext';
import { NodeLabel } from '../ui';

type OperatorNodeProps = NodeProps<Node<JQOperatorData>>;

const operatorGroups: SelectGroup[] = OPERATOR_CATALOG.map((cat) => ({
  label: cat.category,
  options: cat.operators.map((op) => ({
    value: op.symbol,
    label: `${op.symbol}  ${op.description}`,
  })),
}));

export const OperatorNode = memo(({ id, data, selected }: OperatorNodeProps) => {
  const { setNodes } = useReactFlow<Node<JQNodeData>>();
  const takeSnapshot = useSnapshot();
  const readOnly = useTransformerReadOnly();

  const onOperatorChange = useCallback(
    (value: string) => {
      takeSnapshot();
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, operator: value } } : n)),
      );
    },
    [id, setNodes, takeSnapshot],
  );

  const collapsed = !selected;

  // The two operand ports are ORDER-BEARING: for -, /, %, //, and the
  // comparisons, `a op b` differs from `b op a`, so a crossed wire silently
  // inverts the meaning. Name the left dot `a` and the right dot `b` (jq's
  // operand reading order); the operator glyph itself is the card summary between
  // them, so the card reads `a  <op>  b`. The label is node-supplied because it
  // rides the TARGET side — a source-keyed edge chip can't carry it.
  const collapsedHandles: CollapsedHandleConfig[] = useMemo(
    () => [
      {
        id: JQHandleIdPrefix.OperatorLeft,
        position: Position.Left,
        type: 'target',
        handleType: 'target',
        label: 'a',
      },
      {
        id: JQHandleIdPrefix.OperatorRight,
        position: Position.Right,
        type: 'target',
        handleType: 'target',
        label: 'b',
      },
    ],
    [],
  );

  return (
    <TransformerNode
      id={id}
      nodeType={JQNodeType.Operator}
      title="Operator"
      icon={<Calculator className="jqs-jq-icon" />}
      selected={selected}
      collapsed={collapsed}
      summary={data.operator}
      hasTargetHandle={false}
      hasSourceHandle={false}
    >
      {collapsed ? (
        <CollapsedHandles nodeId={id} nodeType={JQNodeType.Operator} handles={collapsedHandles} />
      ) : (
        <>
          <div className="jqs-jq-field">
            <NodeLabel>Operation</NodeLabel>
            <Select
              value={data.operator}
              onValueChange={onOperatorChange}
              disabled={readOnly}
              placeholder="Select operator"
              aria-label="Operator"
              groups={operatorGroups}
            />
          </div>

          <div className="jqs-jq-node__side jqs-jq-node__side--left">
            <TransformerHandle
              nodeId={id}
              nodeType={JQNodeType.Operator}
              position={Position.Left}
              type="target"
              handleType="target"
              id={JQHandleIdPrefix.OperatorLeft}
              label="a"
              labelOutside
            />
          </div>

          <div className="jqs-jq-node__side jqs-jq-node__side--right">
            <TransformerHandle
              nodeId={id}
              nodeType={JQNodeType.Operator}
              position={Position.Right}
              type="target"
              handleType="target"
              id={JQHandleIdPrefix.OperatorRight}
              label="b"
              labelOutside
            />
          </div>
        </>
      )}
    </TransformerNode>
  );
});

OperatorNode.displayName = 'OperatorNode';
