import { memo, useCallback, useMemo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Position, useReactFlow } from '@xyflow/react';
import { GitBranch, Plus, X } from 'lucide-react';
import { Button } from '../primitives';
import { JQNodeType, JQHandleIdPrefix } from '../enums';
import type { JQConditionData, JQNodeData } from '../types';
import { useSnapshot } from '../SnapshotContext';
import { TransformerNode } from './TransformerNode';
import { TransformerHandle } from './TransformerHandle';
import { CollapsedHandles } from './CollapsedHandles';
import type { CollapsedHandleConfig } from './CollapsedHandles';
import { useTransformerReadOnly } from '../TransformerContext';

type ConditionNodeProps = NodeProps<Node<JQConditionData>>;

export const ConditionNode = memo(({ id, data, selected }: ConditionNodeProps) => {
  const { setNodes } = useReactFlow<Node<JQNodeData>>();
  const takeSnapshot = useSnapshot();
  const readOnly = useTransformerReadOnly();

  const addBranch = useCallback(() => {
    takeSnapshot();
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const current = n.data as JQConditionData;
        return {
          ...n,
          data: { ...current, branches: [...current.branches, { id: crypto.randomUUID() }] },
        };
      }),
    );
  }, [id, setNodes, takeSnapshot]);

  const removeBranch = useCallback(
    (branchId: string) => {
      takeSnapshot();
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const current = n.data as JQConditionData;
          return {
            ...n,
            data: { ...current, branches: current.branches.filter((b) => b.id !== branchId) },
          };
        }),
      );
    },
    [id, setNodes, takeSnapshot],
  );

  const collapsed = !selected;

  // A generated content summary for the promoted card name slot (Condition has no
  // free-text content of its own): how many branches feed the decision.
  const branchCount = data.branches.length;
  const summary = `if · ${String(branchCount)} branch${branchCount === 1 ? '' : 'es'}`;

  const collapsedHandles: CollapsedHandleConfig[] = useMemo(
    () => [
      ...data.branches.flatMap((_, index): CollapsedHandleConfig[] => [
        {
          id: `${JQHandleIdPrefix.If}:${String(index)}`,
          position: Position.Right,
          type: 'source',
          handleType: 'source',
        },
        {
          id: `${JQHandleIdPrefix.Then}:${String(index)}`,
          position: Position.Right,
          type: 'source',
          handleType: 'source',
        },
      ]),
      {
        id: JQHandleIdPrefix.Else,
        position: Position.Right,
        type: 'source',
        handleType: 'source',
      },
    ],
    [data.branches],
  );

  return (
    <TransformerNode
      id={id}
      nodeType={JQNodeType.Condition}
      title="Condition"
      icon={<GitBranch className="jqs-jq-icon" />}
      selected={selected}
      collapsed={collapsed}
      summary={summary}
    >
      {collapsed ? (
        <CollapsedHandles nodeId={id} nodeType={JQNodeType.Condition} handles={collapsedHandles} />
      ) : (
        <div className="jqs-jq-branches">
          {data.branches.map((branch, index) => (
            <div key={branch.id} className="jqs-jq-branch">
              <div className="jqs-jq-branch__row">
                <span className="jqs-jq-branch__label">{index === 0 ? 'if' : 'else if'}</span>
                {index > 0 && !readOnly && (
                  <button
                    type="button"
                    className="jqs-jq-icon-btn"
                    onClick={() => {
                      removeBranch(branch.id);
                    }}
                    aria-label="Remove branch"
                  >
                    <X className="jqs-jq-icon-sm" />
                  </button>
                )}
              </div>
              <div className="jqs-jq-branch__handle jqs-jq-branch__handle--if">
                <TransformerHandle
                  nodeId={id}
                  nodeType={JQNodeType.Condition}
                  position={Position.Right}
                  type="source"
                  handleType="source"
                  id={`${JQHandleIdPrefix.If}:${String(index)}`}
                />
              </div>

              <div className="jqs-jq-branch__row">
                <span className="jqs-jq-branch__label">then</span>
              </div>
              <div className="jqs-jq-branch__handle jqs-jq-branch__handle--then">
                <TransformerHandle
                  nodeId={id}
                  nodeType={JQNodeType.Condition}
                  position={Position.Right}
                  type="source"
                  handleType="source"
                  id={`${JQHandleIdPrefix.Then}:${String(index)}`}
                />
              </div>
            </div>
          ))}

          <div className="jqs-jq-branch jqs-jq-branch--else">
            <span className="jqs-jq-branch__label">else</span>
            <div className="jqs-jq-branch__handle jqs-jq-branch__handle--else">
              <TransformerHandle
                nodeId={id}
                nodeType={JQNodeType.Condition}
                position={Position.Right}
                type="source"
                handleType="source"
                id={JQHandleIdPrefix.Else}
              />
            </div>
          </div>

          {!readOnly && (
            <Button onClick={addBranch} style={{ width: '100%', justifyContent: 'center' }}>
              <Plus className="jqs-jq-icon-sm" /> Add else if
            </Button>
          )}
        </div>
      )}
    </TransformerNode>
  );
});

ConditionNode.displayName = 'ConditionNode';
