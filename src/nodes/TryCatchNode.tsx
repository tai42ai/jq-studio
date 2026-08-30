import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { ShieldAlert } from 'lucide-react';
import { JQNodeType, JQHandleIdPrefix } from '../enums';
import type { JQTryCatchData } from '../types';
import { TransformerNode } from './TransformerNode';
import { TransformerHandle } from './TransformerHandle';
import { CollapsedHandles } from './CollapsedHandles';
import type { CollapsedHandleConfig } from './CollapsedHandles';

type TryCatchNodeProps = NodeProps<Node<JQTryCatchData>>;

const collapsedHandles: CollapsedHandleConfig[] = [
  { id: JQHandleIdPrefix.Try, position: Position.Right, type: 'source', handleType: 'source' },
  { id: JQHandleIdPrefix.Catch, position: Position.Right, type: 'source', handleType: 'source' },
];

export const TryCatchNode = memo(({ id, selected }: TryCatchNodeProps) => {
  const collapsed = !selected;

  return (
    <TransformerNode
      id={id}
      nodeType={JQNodeType.TryCatch}
      title="Try/Catch"
      icon={<ShieldAlert className="jqs-jq-icon" />}
      selected={selected}
      collapsed={collapsed}
      summary="try · catch"
    >
      {collapsed ? (
        <CollapsedHandles nodeId={id} nodeType={JQNodeType.TryCatch} handles={collapsedHandles} />
      ) : (
        <div className="jqs-jq-branches">
          <div className="jqs-jq-branch jqs-jq-branch--else">
            <span className="jqs-jq-branch__label">try</span>
            <div className="jqs-jq-branch__handle jqs-jq-branch__handle--else">
              <TransformerHandle
                nodeId={id}
                nodeType={JQNodeType.TryCatch}
                position={Position.Right}
                type="source"
                handleType="source"
                id={JQHandleIdPrefix.Try}
              />
            </div>
          </div>

          <div className="jqs-jq-branch jqs-jq-branch--else">
            <span className="jqs-jq-branch__label">catch</span>
            <div className="jqs-jq-branch__handle jqs-jq-branch__handle--else">
              <TransformerHandle
                nodeId={id}
                nodeType={JQNodeType.TryCatch}
                position={Position.Right}
                type="source"
                handleType="source"
                id={JQHandleIdPrefix.Catch}
              />
            </div>
          </div>
        </div>
      )}
    </TransformerNode>
  );
});

TryCatchNode.displayName = 'TryCatchNode';
