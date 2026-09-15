import { Position } from '@xyflow/react';
import { Plus, Trash2 } from 'lucide-react';
import { memo } from 'react';

import { JQHandleIdPrefix, JQNodeType } from '../../enums';
import { Button } from '../../primitives';
import type { ValueArrayItem } from '../../types';
import { TransformerHandle } from '../TransformerHandle';

interface ArrayValueEditorProps {
  nodeId: string;
  items: ValueArrayItem[];
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (itemId: string) => void;
}

/** Editor for an array literal: one source handle per element (each wired to the
 *  value that fills that slot), plus an add-item control. */
export const ArrayValueEditor = memo(
  ({ nodeId, items, readOnly, onAdd, onRemove }: ArrayValueEditorProps) => (
    <div className="jqs-jq-collection">
      {items.map((item, index) => (
        <div key={item.id} className="jqs-jq-collection__row">
          <span className="jqs-jq-row__label">[{index}]</span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                onRemove(item.id);
              }}
              className="jqs-jq-icon-btn"
              aria-label="Remove item"
            >
              <Trash2 className="jqs-jq-icon-sm" />
            </button>
          )}
          <div className="jqs-jq-collection__handle">
            <TransformerHandle
              nodeId={nodeId}
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
        <Button onClick={onAdd} style={{ width: '100%', justifyContent: 'center' }}>
          <Plus className="jqs-jq-icon-sm" /> Add Item
        </Button>
      )}
    </div>
  ),
);

ArrayValueEditor.displayName = 'ArrayValueEditor';
