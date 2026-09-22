import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

import type {
  JqInputShapeDescriptor,
  SampleInputProvider,
  SampleVariablesProvider,
  ServerValidateHook,
} from './declaration';
import { JqTestPanel } from './JqTestPanel';
import { LoadExpressionDialog } from './LoadExpressionDialog';
import type { JQEdge, JQNode } from './types';
import type { ValidationErrorMap } from './utils/flow-validator';
import { assertJqVariableName } from './utils/jq-variable-binding';

/** The JSON string the Test input is seeded with: the host's live `sampleInput()`
 *  when it yields a defined value, else the shape's static `sample`, else
 *  undefined (a blank input). A throwing provider propagates — the caller turns
 *  it into a visible run error rather than masking it. */
const resolveSampleInput = (
  sampleInput: SampleInputProvider | undefined,
  shape: JqInputShapeDescriptor | undefined,
): string | undefined => {
  if (sampleInput) {
    const live = sampleInput();
    if (live !== undefined) return JSON.stringify(live, null, 2);
  }
  return shape?.sample !== undefined ? JSON.stringify(shape.sample, null, 2) : undefined;
};

/** The value bound for each declared variable on Run: the host's live
 *  `sampleVariables()` entry when present, else the variable's static `sample`,
 *  else `null` — so a declared `$name` is always defined, never a compile error.
 *  Each declared name is held to the binder's own rule first, so a reserved or
 *  malformed name fails here (surfaced as the run's error) rather than throwing
 *  out of the Run click. The map has a null prototype and provider entries are
 *  read by own-key only, so a name like `__proto__` binds as its own key and a
 *  name like `constructor` never resolves to an inherited value. A throwing
 *  provider propagates for the caller to surface. */
const resolveSampleVariables = (
  sampleVariables: SampleVariablesProvider | undefined,
  shape: JqInputShapeDescriptor | undefined,
): Record<string, unknown> => {
  const declared = shape?.variables ?? [];
  if (declared.length === 0) return {};
  const live = sampleVariables ? sampleVariables() : {};
  const resolved = Object.create(null) as Record<string, unknown>;
  for (const variable of declared) {
    assertJqVariableName(variable.name);
    resolved[variable.name] = Object.hasOwn(live, variable.name)
      ? live[variable.name]
      : (variable.sample ?? null);
  }
  return resolved;
};

interface CanvasToolbarProps {
  problemCount: number;
  problemNodeIds: string[];
  focusNextProblem: () => void;
  onLoad: (nodes: JQNode[], edges: JQEdge[]) => void;
  expression: string;
  validationErrors: ValidationErrorMap;
  shape?: JqInputShapeDescriptor;
  sampleInput?: SampleInputProvider;
  sampleVariables?: SampleVariablesProvider;
  serverValidate?: ServerValidateHook;
}

/** The canvas toolbar: a problem-summary chip (present only when the graph has
 *  problems), the Load-expression dialog, and the Test panel. Seeds the Test
 *  panel by declared precedence — a host's live `sampleInput()` when it yields a
 *  defined value, else the shape's static `sample`, else a blank input — and
 *  resolves each declared variable's sample the same way for the run's `$name`
 *  bindings. */
export const CanvasToolbar = ({
  problemCount,
  problemNodeIds,
  focusNextProblem,
  onLoad,
  expression,
  validationErrors,
  shape,
  sampleInput,
  sampleVariables,
  serverValidate,
}: CanvasToolbarProps) => {
  // A host sample provider that throws is a real failure, not a "no sample"
  // signal: capture its message and surface it as the run's error (nothing runs)
  // rather than binding a silent fallback.
  const { testSample, testVariables, sampleError } = useMemo<{
    testSample: string | undefined;
    testVariables: Record<string, unknown>;
    sampleError: string | undefined;
  }>(() => {
    try {
      return {
        testSample: resolveSampleInput(sampleInput, shape),
        testVariables: resolveSampleVariables(sampleVariables, shape),
        sampleError: undefined,
      };
    } catch (err) {
      return {
        testSample: undefined,
        testVariables: {},
        sampleError: err instanceof Error ? err.message : String(err),
      };
    }
  }, [sampleInput, sampleVariables, shape]);

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
        sampleVariables={testVariables}
        variables={shape?.variables?.map((variable) => ({
          name: variable.name,
          blurb: variable.blurb,
        }))}
        shapeLabel={shape?.label}
        returns={shape?.returns}
        sampleError={sampleError}
        serverValidate={serverValidate}
      />
    </div>
  );
};
