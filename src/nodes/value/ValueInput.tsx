import { memo, useCallback } from 'react';

import { ValueType } from '../../enums';
import type { JQValueData, PathSegment } from '../../types';
import { compilePathSegments } from '../../utils/path-segments';
import { PathSelector } from '../PathSelector';
import { ArrayValueEditor } from './ArrayValueEditor';
import { BooleanValueInput } from './BooleanValueInput';
import { NumberValueInput } from './NumberValueInput';
import { ObjectValueEditor } from './ObjectValueEditor';
import { StringValueInput } from './StringValueInput';
import {
  addArrayItem,
  addObjectField,
  removeArrayItem,
  removeObjectField,
  setObjectFieldName,
} from './value-data';

interface ValueInputProps {
  nodeId: string;
  data: JQValueData;
  readOnly: boolean;
  updateData: (updates: Partial<JQValueData>) => void;
  takeSnapshot: () => void;
}

/** Renders the editor for the node's current value type: a scalar input, an
 *  array/object collection editor, a path selector, or nothing for `null`. */
export const ValueInput = memo(
  ({ nodeId, data, readOnly, updateData, takeSnapshot }: ValueInputProps) => {
    const snapshot = useCallback(() => {
      takeSnapshot();
    }, [takeSnapshot]);

    switch (data.valueType) {
      case ValueType.String:
        return (
          <StringValueInput
            value={(data.value ?? '') as string}
            readOnly={readOnly}
            onCommit={(value) => {
              updateData({ value });
            }}
            onFocus={snapshot}
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
            onFocus={snapshot}
          />
        );
      case ValueType.Boolean:
        return (
          <BooleanValueInput
            value={!!data.value}
            readOnly={readOnly}
            onCommit={(value) => {
              updateData({ value });
            }}
          />
        );
      case ValueType.Array:
        return (
          <ArrayValueEditor
            nodeId={nodeId}
            items={data.items ?? []}
            readOnly={readOnly}
            onAdd={() => {
              takeSnapshot();
              updateData({ items: addArrayItem(data.items ?? []) });
            }}
            onRemove={(itemId) => {
              takeSnapshot();
              updateData({ items: removeArrayItem(data.items ?? [], itemId) });
            }}
          />
        );
      case ValueType.Object:
        return (
          <ObjectValueEditor
            nodeId={nodeId}
            fields={data.fields ?? []}
            readOnly={readOnly}
            onAdd={() => {
              takeSnapshot();
              updateData({ fields: addObjectField(data.fields ?? []) });
            }}
            onRemove={(fieldId) => {
              takeSnapshot();
              updateData({ fields: removeObjectField(data.fields ?? [], fieldId) });
            }}
            onRenameField={(fieldId, name) => {
              updateData({ fields: setObjectFieldName(data.fields ?? [], fieldId, name) });
            }}
            onFocus={snapshot}
          />
        );
      case ValueType.Path:
        return (
          <PathSelector
            nodeId={nodeId}
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
  },
);

ValueInput.displayName = 'ValueInput';
