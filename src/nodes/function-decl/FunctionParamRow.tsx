import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { memo, useMemo } from 'react';

import { TextInput } from '../../primitives';
import { nameVerdict } from '../../utils/name-validation';

const errorInputStyle: CSSProperties = { borderColor: 'var(--jq-color-danger)' };

interface FunctionParamRowProps {
  index: number;
  param: string;
  siblingParams: string[];
  reservedNames: string[];
  readOnly: boolean;
  onChange: (index: number, value: string) => void;
  onFocus: () => void;
  onRemove: (index: number) => void;
}

/** The single error line for a parameter name, keyed off its verdict flags, or
 *  null when the (possibly empty) name is fine. */
const paramErrorMessage = (verdict: ReturnType<typeof nameVerdict>): string | null => {
  if (verdict.empty) return null;
  if (!verdict.valid) return 'Invalid parameter name';
  if (verdict.reserved) return 'Reserved word';
  if (!verdict.unique) return 'Duplicate parameter name';
  return null;
};

/** One editable parameter-name row of a Define-Function node, validating the
 *  name against the identifier rule, the reserved set, and its sibling params. */
export const FunctionParamRow = memo(
  ({
    index,
    param,
    siblingParams,
    reservedNames,
    readOnly,
    onChange,
    onFocus,
    onRemove,
  }: FunctionParamRowProps) => {
    const verdict = useMemo(
      () => nameVerdict(param, siblingParams, reservedNames),
      [param, siblingParams, reservedNames],
    );
    const errorMessage = paramErrorMessage(verdict);

    return (
      <div>
        <div className="jqs-jq-params__row">
          <TextInput
            value={param}
            onChange={(e) => {
              onChange(index, e.target.value);
            }}
            onFocus={onFocus}
            readOnly={readOnly}
            placeholder={`param${String(index + 1)}`}
            style={errorMessage ? errorInputStyle : undefined}
          />
          {!readOnly && (
            <button
              type="button"
              className="jqs-jq-icon-btn jqs-jq-icon-btn--danger"
              onClick={() => {
                onRemove(index);
              }}
              aria-label="Remove parameter"
            >
              <X className="jqs-jq-icon-sm" />
            </button>
          )}
        </div>
        {errorMessage && <p className="jqs-jq-field__error">{errorMessage}</p>}
      </div>
    );
  },
);

FunctionParamRow.displayName = 'FunctionParamRow';
