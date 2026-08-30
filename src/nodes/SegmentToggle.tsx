import { memo } from 'react';
import clsx from 'clsx';

interface SegmentToggleProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

export const SegmentToggle = memo(
  ({ value, onValueChange, options, disabled }: SegmentToggleProps) => (
    <div className="jqs-jq-segtoggle" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt.value}
          className={clsx(
            'jqs-jq-segtoggle__item',
            value === opt.value && 'jqs-jq-segtoggle__item--on',
          )}
          onClick={() => {
            onValueChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
);

SegmentToggle.displayName = 'SegmentToggle';
