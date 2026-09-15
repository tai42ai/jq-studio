import { Position } from '@xyflow/react';
import { Plus, Trash2 } from 'lucide-react';
import { memo } from 'react';

import { JQHandleIdPrefix, JQNodeType } from '../../enums';
import { Button, TextInput } from '../../primitives';
import type { ValueObjectField } from '../../types';
import { TransformerHandle } from '../TransformerHandle';

interface ObjectValueEditorProps {
  nodeId: string;
  fields: ValueObjectField[];
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (fieldId: string) => void;
  onRenameField: (fieldId: string, name: string) => void;
  onFocus: () => void;
}

/** Editor for an object literal: an editable key plus a source handle per field
 *  (each wired to the value that fills it), plus an add-field control. */
export const ObjectValueEditor = memo(
  ({
    nodeId,
    fields,
    readOnly,
    onAdd,
    onRemove,
    onRenameField,
    onFocus,
  }: ObjectValueEditorProps) => (
    <div className="jqs-jq-collection">
      {fields.map((field) => (
        <div key={field.id} className="jqs-jq-collection__row">
          <TextInput
            value={field.name}
            onChange={(e) => {
              onRenameField(field.id, e.target.value);
            }}
            onFocus={onFocus}
            readOnly={readOnly}
            placeholder="key"
          />
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                onRemove(field.id);
              }}
              className="jqs-jq-icon-btn"
              aria-label="Remove field"
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
              id={`${JQHandleIdPrefix.Field}:${field.id}`}
              label=""
            />
          </div>
        </div>
      ))}
      {!readOnly && (
        <Button onClick={onAdd} style={{ width: '100%', justifyContent: 'center' }}>
          <Plus className="jqs-jq-icon-sm" /> Add Field
        </Button>
      )}
    </div>
  ),
);

ObjectValueEditor.displayName = 'ObjectValueEditor';
