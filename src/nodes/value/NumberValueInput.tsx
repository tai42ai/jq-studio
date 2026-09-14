import { memo, useEffect, useState } from 'react';
import { TextInput } from '../../primitives';

interface NumberValueInputProps {
  value: number;
  readOnly: boolean;
  onCommit: (n: number) => void;
  onFocus?: () => void;
}

/**
 * Numeric value input that keeps the RAW typed string in local state and commits
 * only a finite parse, so an empty or partial entry never writes 0/NaN to the node.
 */
export const NumberValueInput = memo(
  ({ value, readOnly, onCommit, onFocus }: NumberValueInputProps) => {
    const [text, setText] = useState(() => String(value));

    // Follow the stored number when it changes from outside this input (type
    // switch, undo/redo) without overwriting a partial entry the user is typing.
    useEffect(() => {
      if (Number(text) !== value) setText(String(value));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
      <TextInput
        type="number"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const parsed = Number(raw);
          if (raw.trim() !== '' && Number.isFinite(parsed)) onCommit(parsed);
        }}
        onFocus={onFocus}
        readOnly={readOnly}
        placeholder="Enter number"
      />
    );
  },
);

NumberValueInput.displayName = 'NumberValueInput';
