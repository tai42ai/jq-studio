import { Textarea, TextInput } from '../primitives';

interface JqRestingControlProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  multiline: boolean;
  readOnly: boolean;
  placeholder?: string;
  describedBy?: string;
  invalid?: true;
}

/** The field's resting expression control: a single-line input, or a textarea
 *  when `multiline`. Both wire the a11y `aria-describedby` / `aria-invalid`. */
export const JqRestingControl = ({
  id,
  value,
  onChange,
  multiline,
  readOnly,
  placeholder,
  describedBy,
  invalid,
}: JqRestingControlProps) =>
  multiline ? (
    <Textarea
      id={id}
      className="jqs-field__control"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      readOnly={readOnly}
      placeholder={placeholder}
      spellCheck={false}
      rows={3}
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  ) : (
    <TextInput
      id={id}
      className="jqs-field__control"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      readOnly={readOnly}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  );
