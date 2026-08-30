import { memo, useCallback, useMemo } from 'react';
import { useNodes, useEdges } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { Plus, X } from 'lucide-react';
import { Button, Select, TextInput } from '../primitives';
import type { SelectGroup, SelectOption } from '../primitives';
import type { PathSegment, JQNodeData } from '../types';
import { JQNodeType } from '../enums';
import { compilePathSegments } from '../utils/path-segments';
import { SegmentToggle } from './SegmentToggle';
import { useTransformerReadOnly } from '../TransformerContext';

export { compilePathSegments };

interface PathSelectorProps {
  nodeId: string;
  segments: PathSegment[];
  onSegmentsChange: (segments: PathSegment[]) => void;
}

let segCounter = 0;
const nextSegId = () => `seg_${String(++segCounter)}`;

type ArrayMode = 'index' | 'range';
type SegmentMode = 'object' | 'array';

const getSegmentMode = (seg: PathSegment): SegmentMode =>
  seg.type === 'index' || seg.type === 'range' ? 'array' : 'object';

const getArrayMode = (seg: PathSegment): ArrayMode => (seg.type === 'range' ? 'range' : 'index');

export const PathSelector = memo(({ nodeId, segments, onSegmentsChange }: PathSelectorProps) => {
  const allNodes = useNodes<Node<JQNodeData>>();
  const allEdges = useEdges();
  const readOnly = useTransformerReadOnly();

  const precedingNodeNames = useMemo(() => {
    const upstream = new Set<string>();
    const visit = (nId: string) => {
      for (const e of allEdges) {
        if (e.target === nId && !upstream.has(e.source)) {
          upstream.add(e.source);
          visit(e.source);
        }
      }
    };
    visit(nodeId);

    return allNodes
      .filter(
        (n) =>
          upstream.has(n.id) &&
          (n.data.type === JQNodeType.Value || n.data.type === JQNodeType.FunctionCall) &&
          !!n.data.name,
      )
      .map((n) => n.data.name ?? '');
  }, [nodeId, allNodes, allEdges]);

  const ancestorFuncParams = useMemo(() => {
    const visited = new Set<string>();
    const queue = [nodeId];
    const params: string[] = [];

    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined) continue;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const e of allEdges) {
        if (e.target === current) {
          const sourceNode = allNodes.find((n) => n.id === e.source);
          if (sourceNode?.data.type === JQNodeType.FunctionDecl) {
            const declData = sourceNode.data;
            if (declData.parameters) {
              params.push(...declData.parameters);
            }
          }
          queue.push(e.source);
        }
      }
    }

    return [...new Set(params)];
  }, [nodeId, allNodes, allEdges]);

  const updateSegment = useCallback(
    (index: number, updates: Partial<PathSegment>) => {
      const next = segments.map((s, i) => (i === index ? { ...s, ...updates } : s));
      onSegmentsChange(next);
    },
    [segments, onSegmentsChange],
  );

  const removeSegmentFrom = useCallback(
    (index: number) => {
      onSegmentsChange(segments.slice(0, index));
    },
    [segments, onSegmentsChange],
  );

  const addSegment = useCallback(() => {
    const newSeg: PathSegment = { id: nextSegId(), type: 'field', value: '' };
    onSegmentsChange([...segments, newSeg]);
  }, [segments, onSegmentsChange]);

  const onRootChange = useCallback(
    (value: string) => {
      if (value === '.') {
        updateSegment(0, { type: 'root', value: '.' });
      } else {
        updateSegment(0, { type: 'node_ref', value });
      }
    },
    [updateSegment],
  );

  const onModeToggle = useCallback(
    (index: number, mode: SegmentMode) => {
      const seg = segments[index];
      if (!seg) return;
      // Truncate segments after this one since the context changed.
      onSegmentsChange(
        segments
          .slice(0, index)
          .concat([
            mode === 'object'
              ? { ...seg, type: 'field', value: '', rangeEnd: undefined }
              : { ...seg, type: 'index', value: '0', rangeEnd: undefined },
          ]),
      );
    },
    [segments, onSegmentsChange],
  );

  const onArrayModeToggle = useCallback(
    (index: number, mode: ArrayMode) => {
      if (mode === 'index') {
        updateSegment(index, { type: 'index', value: '0', rangeEnd: undefined });
      } else {
        updateSegment(index, { type: 'range', value: '0', rangeEnd: '5' });
      }
    },
    [updateSegment],
  );

  const rootSeg = segments[0];
  const rootValue = rootSeg?.type === 'node_ref' ? rootSeg.value : '.';

  const rootChoices: SelectOption[] = useMemo(
    () => [{ value: '.', label: '.' }, ...precedingNodeNames.map((n) => ({ value: n, label: n }))],
    [precedingNodeNames],
  );
  const rootGroups: SelectGroup[] | undefined = useMemo(() => {
    if (ancestorFuncParams.length === 0) return undefined;
    return [
      { label: 'Path root', options: rootChoices },
      { label: 'Parameters', options: ancestorFuncParams.map((p) => ({ value: p, label: p })) },
    ];
  }, [rootChoices, ancestorFuncParams]);

  return (
    <div className="jqs-jq-path">
      <div className="jqs-jq-path__root">
        <span className="jqs-jq-path__root-label">root</span>
        {rootGroups ? (
          <Select
            value={rootValue}
            onValueChange={onRootChange}
            disabled={readOnly}
            aria-label="Path root"
            groups={rootGroups}
          />
        ) : (
          <Select
            value={rootValue}
            onValueChange={onRootChange}
            disabled={readOnly}
            aria-label="Path root"
            options={rootChoices}
          />
        )}
      </div>

      {segments.slice(1).map((seg, idx) => {
        const realIndex = idx + 1;
        const mode = getSegmentMode(seg);
        const arrMode = getArrayMode(seg);

        return (
          <div key={seg.id} className="jqs-jq-path__segment">
            <div className="jqs-jq-path__segment-row">
              <SegmentToggle
                value={mode}
                onValueChange={(v) => {
                  onModeToggle(realIndex, v as SegmentMode);
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
                    updateSegment(realIndex, { value: e.target.value });
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
                      onArrayModeToggle(realIndex, v as ArrayMode);
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
                        updateSegment(realIndex, { value: e.target.value });
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
                          updateSegment(realIndex, { value: e.target.value });
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
                          updateSegment(realIndex, { rangeEnd: e.target.value });
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
                    removeSegmentFrom(realIndex);
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
      })}

      {!readOnly && (
        <Button onClick={addSegment} style={{ width: '100%', justifyContent: 'center' }}>
          <Plus className="jqs-jq-icon-sm" /> Add Segment
        </Button>
      )}

      <div className="jqs-jq-path__preview">{compilePathSegments(segments)}</div>
    </div>
  );
});

PathSelector.displayName = 'PathSelector';
