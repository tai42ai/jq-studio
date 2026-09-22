import type { Node } from '@xyflow/react';
import { useEdges, useNodes } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

import type { SelectGroup, SelectOption } from '../primitives';
import { Button, Select } from '../primitives';
import { useDeclaredVariables, useTransformerReadOnly } from '../TransformerContext';
import type { JQNodeData, PathSegment } from '../types';
import { ancestorFunctionParams, precedingNamedNodes } from '../utils/graph-scope';
import { compilePathSegments } from '../utils/path-segments';
import type { ArrayMode, SegmentMode } from './path/PathSegmentRow';
import { PathSegmentRow } from './path/PathSegmentRow';

interface PathSelectorProps {
  nodeId: string;
  segments: PathSegment[];
  onSegmentsChange: (segments: PathSegment[]) => void;
}

let segCounter = 0;
const nextSegId = () => `seg_${String(++segCounter)}`;

export const PathSelector = memo(({ nodeId, segments, onSegmentsChange }: PathSelectorProps) => {
  const allNodes = useNodes<Node<JQNodeData>>();
  const allEdges = useEdges();
  const readOnly = useTransformerReadOnly();
  const declaredVariables = useDeclaredVariables();

  const precedingNodeNames = useMemo(
    () => precedingNamedNodes(allNodes, allEdges, nodeId),
    [nodeId, allNodes, allEdges],
  );

  const ancestorFuncParams = useMemo(
    () => ancestorFunctionParams(allNodes, allEdges, nodeId),
    [nodeId, allNodes, allEdges],
  );

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
  // The declared variables the host binds beside `.` join the root menu in
  // their own group — a variable is a valid root of a path just like `.` is.
  const rootGroups: SelectGroup[] | undefined = useMemo(() => {
    if (declaredVariables.length === 0 && ancestorFuncParams.length === 0) return undefined;
    const groups: SelectGroup[] = [{ label: 'Path root', options: rootChoices }];
    if (declaredVariables.length > 0) {
      groups.push({
        label: 'Variables',
        options: declaredVariables.map((v) => ({ value: v, label: `$${v}` })),
      });
    }
    if (ancestorFuncParams.length > 0) {
      groups.push({
        label: 'Parameters',
        options: ancestorFuncParams.map((p) => ({ value: p, label: p })),
      });
    }
    return groups;
  }, [rootChoices, declaredVariables, ancestorFuncParams]);

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

      {segments.slice(1).map((seg, idx) => (
        <PathSegmentRow
          key={seg.id}
          seg={seg}
          index={idx + 1}
          readOnly={readOnly}
          onUpdate={updateSegment}
          onRemove={removeSegmentFrom}
          onModeToggle={onModeToggle}
          onArrayModeToggle={onArrayModeToggle}
        />
      ))}

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
