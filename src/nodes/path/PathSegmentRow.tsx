import { memo } from 'react';
import { X } from 'lucide-react';
import { TextInput } from '../../primitives';
import type { PathSegment } from '../../types';
import { SegmentToggle } from '../SegmentToggle';

type ArrayMode = 'index' | 'range';
type SegmentMode = 'object' | 'array';

const getSegmentMode = (seg: PathSegment): SegmentMode =>
  seg.type === 'index' || seg.type === 'range' ? 'array' : 'object';

const getArrayMode = (seg: PathSegment): ArrayMode => (seg.type === 'range' ? 'range' : 'index');

interface PathSegmentRowProps {
  seg: PathSegment;
  index: number;
  readOnly: boolean;
  onUpdate: (index: number, updates: Partial<PathSegment>) => void;
  onRemove: (index: number) => void;
  onModeToggle: (index: number, mode: SegmentMode) => void;
  onArrayModeToggle: (index: number, mode: ArrayMode) => void;
}

/** One path segment: an object-key field, or an array index / range, with an
 *  obj↔arr mode toggle and a remove control. */
export const PathSegmentRow = memo(
  ({
    seg,
    index,
    readOnly,
    onUpdate,
    onRemove,
    onModeToggle,
    onArrayModeToggle,
  }: PathSegmentRowProps) => {
    const mode = getSegmentMode(seg);
    const arrMode = getArrayMode(seg);

    return (
      <div className="jqs-jq-path__segment">
        <div className="jqs-jq-path__segment-row">
          <SegmentToggle
            value={mode}
            onValueChange={(v) => {
              onModeToggle(index, v as SegmentMode);
            }}
            disabled={readOnly}
            options={[
              { value: 'object', label: 'obj' },
              { value: 'array', label: 'arr' },
            ]}
          />

          {mode === 'object' && (
            <TextInput
              value={seg.value}
              onChange={(e) => {
                onUpdate(index, { value: e.target.value });
              }}
              readOnly={readOnly}
              placeholder="field"
            />
          )}

          {mode === 'array' && (
            <>
              <SegmentToggle
                value={arrMode}
                onValueChange={(v) => {
                  onArrayModeToggle(index, v as ArrayMode);
                }}
                disabled={readOnly}
                options={[
                  { value: 'index', label: 'idx' },
                  { value: 'range', label: 'range' },
                ]}
              />

              {arrMode === 'index' && (
                <TextInput
                  type="number"
                  value={seg.value}
                  onChange={(e) => {
                    onUpdate(index, { value: e.target.value });
                  }}
                  readOnly={readOnly}
                  placeholder="0"
                  style={{ width: '4rem' }}
                />
              )}

              {arrMode === 'range' && (
                <div className="jqs-jq-path__range">
                  <TextInput
                    type="number"
                    value={seg.value}
                    onChange={(e) => {
                      onUpdate(index, { value: e.target.value });
                    }}
                    readOnly={readOnly}
                    placeholder="0"
                    style={{ width: '3.5rem' }}
                  />
                  <span className="jqs-jq-path__range-sep">:</span>
                  <TextInput
                    type="number"
                    value={seg.rangeEnd ?? ''}
                    onChange={(e) => {
                      onUpdate(index, { rangeEnd: e.target.value });
                    }}
                    readOnly={readOnly}
                    placeholder="5"
                    style={{ width: '3.5rem' }}
                  />
                </div>
              )}
            </>
          )}

          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                onRemove(index);
              }}
              className="jqs-jq-icon-btn"
              aria-label="Remove segment"
            >
              <X className="jqs-jq-icon-sm" />
            </button>
          )}
        </div>
      </div>
    );
  },
);

PathSegmentRow.displayName = 'PathSegmentRow';

export type { ArrayMode, SegmentMode };
