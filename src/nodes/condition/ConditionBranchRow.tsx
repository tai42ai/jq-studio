import { Position } from '@xyflow/react';
import { X } from 'lucide-react';
import { memo } from 'react';

import { JQHandleIdPrefix, JQNodeType } from '../../enums';
import { TransformerHandle } from '../TransformerHandle';

interface ConditionBranchRowProps {
  nodeId: string;
  branchId: string;
  index: number;
  readOnly: boolean;
  onRemove: (branchId: string) => void;
}

/** One `if …/then …` branch of a Condition node: the guarded predicate handle and
 *  its result handle, with a remove control on every branch past the first. */
export const ConditionBranchRow = memo(
  ({ nodeId, branchId, index, readOnly, onRemove }: ConditionBranchRowProps) => (
    <div className="jqs-jq-branch">
      <div className="jqs-jq-branch__row">
        <span className="jqs-jq-branch__label">{index === 0 ? 'if' : 'else if'}</span>
        {index > 0 && !readOnly && (
          <button
            type="button"
            className="jqs-jq-icon-btn"
            onClick={() => {
              onRemove(branchId);
            }}
            aria-label="Remove branch"
          >
            <X className="jqs-jq-icon-sm" />
          </button>
        )}
      </div>
      <div className="jqs-jq-branch__handle jqs-jq-branch__handle--if">
        <TransformerHandle
          nodeId={nodeId}
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
          nodeId={nodeId}
          nodeType={JQNodeType.Condition}
          position={Position.Right}
          type="source"
          handleType="source"
          id={`${JQHandleIdPrefix.Then}:${String(index)}`}
        />
      </div>
    </div>
  ),
);

ConditionBranchRow.displayName = 'ConditionBranchRow';
