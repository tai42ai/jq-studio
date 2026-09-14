import { memo } from 'react';
import { TextInput } from '../../primitives';

interface StringValueInputProps {
  value: string;
  readOnly: boolean;
  onCommit: (value: string) => void;
  onFocus: () => void;
}

/** Free-text editor for a string value; a focus snapshots the pre-edit state so
 *  the edit is undoable. */
export const StringValueInput = memo(
  ({ value, readOnly, onCommit, onFocus }: StringValueInputProps) => (
    <TextInput
      value={value}
      onChange={(e) => {
        onCommit(e.target.value);
      }}
      onFocus={onFocus}
      readOnly={readOnly}
      placeholder="Enter text"
    />
  ),
);

StringValueInput.displayName = 'StringValueInput';
