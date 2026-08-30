import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { JQNodeType, JQHandleIdPrefix } from '../enums';
import { JQ_KIND_REGISTRY } from '../jq-kind-registry';
import type { JQStartData } from '../types';
import { TransformerNode } from './TransformerNode';
import { TransformerHandle } from './TransformerHandle';

type StartNodeProps = NodeProps<Node<JQStartData>>;

// The root node's identity (caption "Input", the log-in glyph) comes from the
// single kind registry (F5).
const START_KIND = JQ_KIND_REGISTRY[JQNodeType.Start];

export const StartNode = memo(({ id, selected }: StartNodeProps) => {
  return (
    <TransformerNode
      id={id}
      nodeType={JQNodeType.Start}
      title={START_KIND.builderCaption}
      icon={<START_KIND.icon className="jqs-jq-icon" />}
      selected={selected}
      hasTargetHandle={false}
      hasSourceHandle={false}
    >
      <div className="jqs-jq-start">
        <div className="jqs-jq-start__row">
          <span className="jqs-jq-row__label">Functions</span>
          <div className="jqs-jq-start__handle">
            <TransformerHandle
              nodeId={id}
              nodeType={JQNodeType.Start}
              position={Position.Right}
              type="source"
              handleType="source"
              id={JQHandleIdPrefix.Functions}
            />
          </div>
        </div>

        <div className="jqs-jq-start__row">
          {/* One word for this port everywhere: the card label matches the
              handle tooltip's "Result" title (the value the expression returns). */}
          <span className="jqs-jq-row__label">Result</span>
          <div className="jqs-jq-start__handle">
            <TransformerHandle
              nodeId={id}
              nodeType={JQNodeType.Start}
              position={Position.Right}
              type="source"
              handleType="source"
              id={JQHandleIdPrefix.Flow}
            />
          </div>
        </div>
      </div>
    </TransformerNode>
  );
});

StartNode.displayName = 'StartNode';
