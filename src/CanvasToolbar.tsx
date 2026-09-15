import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

import type {
  JqInputShapeDescriptor,
  SampleInputProvider,
  ServerValidateHook,
} from './declaration';
import { JqTestPanel } from './JqTestPanel';
import { LoadExpressionDialog } from './LoadExpressionDialog';
import type { JQEdge, JQNode } from './types';
import type { ValidationErrorMap } from './utils/flow-validator';

interface CanvasToolbarProps {
  problemCount: number;
  problemNodeIds: string[];
  focusNextProblem: () => void;
  onLoad: (nodes: JQNode[], edges: JQEdge[]) => void;
  expression: string;
  validationErrors: ValidationErrorMap;
  shape?: JqInputShapeDescriptor;
  sampleInput?: SampleInputProvider;
  serverValidate?: ServerValidateHook;
}

/** The canvas toolbar: a problem-summary chip (present only when the graph has
 *  problems), the Load-expression dialog, and the Test panel. Seeds the Test
 *  panel by declared precedence — a host's live `sampleInput()` when it yields a
 *  defined value, else the shape's static `sample`, else a blank input. */
export const CanvasToolbar = ({
  problemCount,
  problemNodeIds,
  focusNextProblem,
  onLoad,
  expression,
  validationErrors,
  shape,
  sampleInput,
  serverValidate,
}: CanvasToolbarProps) => {
  const testSample = useMemo(() => {
    if (sampleInput) {
      try {
        const live = sampleInput();
        if (live !== undefined) return JSON.stringify(live, null, 2);
      } catch {
        // A provider that throws is treated as "no live sample" and falls back to
        // the static skeleton — a host seam must never take the Test panel down.
      }
    }
    return shape?.sample !== undefined ? JSON.stringify(shape.sample, null, 2) : undefined;
  }, [sampleInput, shape]);

  return (
    <div className="jqs-jq-canvas__toolbar">
      <div className="jqs-jq-canvas__toolbar-spacer" />
      {problemCount > 0 && (
        <button
          type="button"
          className="jqs-jq-problem-chip"
          onClick={focusNextProblem}
          disabled={problemNodeIds.length === 0}
          title={
            problemNodeIds.length === 0
              ? 'The generated expression could not be built'
              : 'Jump to the next problem'
          }
        >
          <AlertTriangle className="jqs-jq-icon-sm" aria-hidden />
          {problemCount} problem{problemCount === 1 ? '' : 's'}
        </button>
      )}
      <LoadExpressionDialog onLoad={onLoad} />
      <JqTestPanel
        expression={expression}
        validationErrors={validationErrors}
        sampleInput={testSample}
        shapeLabel={shape?.label}
        returns={shape?.returns}
        serverValidate={serverValidate}
      />
    </div>
  );
};
