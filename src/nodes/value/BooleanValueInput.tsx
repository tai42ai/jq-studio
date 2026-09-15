import { memo } from 'react';

import { Checkbox } from '../../primitives';

interface BooleanValueInputProps {
  value: boolean;
  readOnly: boolean;
  onCommit: (value: boolean) => void;
}

/** A boolean value as a labelled checkbox reading `true` / `false`. */
export const BooleanValueInput = memo(({ value, readOnly, onCommit }: BooleanValueInputProps) => (
  <Checkbox
    checked={value}
    onCheckedChange={onCommit}
    disabled={readOnly}
    label={value ? 'true' : 'false'}
  />
));

BooleanValueInput.displayName = 'BooleanValueInput';
