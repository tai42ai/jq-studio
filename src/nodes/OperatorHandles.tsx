import { Position } from '@xyflow/react';
import { JQNodeType, JQHandleIdPrefix } from '../enums';
import { TransformerHandle } from './TransformerHandle';

interface OperatorHandlesProps {
  nodeId: string;
  nodeType: JQNodeType;
  showLeftHandle: boolean;
}

export const OperatorHandles = ({ nodeId, nodeType, showLeftHandle }: OperatorHandlesProps) => (
  <div className="jqs-jq-operator-handles">
    {showLeftHandle && (
      <div className="jqs-jq-operator-handles__slot jqs-jq-operator-handles__slot--left">
        <TransformerHandle
          nodeId={nodeId}
          nodeType={nodeType}
          position={Position.Left}
          type="source"
          handleType="source"
          id={`${JQHandleIdPrefix.OperatorLeft}:${nodeId}`}
          label="Operation"
        />
      </div>
    )}

    <div className="jqs-jq-operator-handles__slot jqs-jq-operator-handles__slot--right">
      <TransformerHandle
        nodeId={nodeId}
        nodeType={nodeType}
        position={Position.Right}
        type="source"
        handleType="source"
        id={`${JQHandleIdPrefix.OperatorRight}:${nodeId}`}
        label="Operation"
      />
    </div>
  </div>
);
