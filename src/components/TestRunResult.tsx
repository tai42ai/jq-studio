import { AlertCircle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import type { JqResult } from '../utils/jq-loader';

interface TestRunResultProps {
  result: JqResult;
  returns?: string;
}

/** The output of a Test run: a success/error header (with what the expression
 *  must return) over the colour-coded output or error text. */
export const TestRunResult = ({ result, returns }: TestRunResultProps) => (
  <div className="jqs-jq-field">
    <div className="jqs-jq-field__label-row">
      {result.success ? (
        <CheckCircle2 className="jqs-jq-icon-sm jqs-jq-ok" />
      ) : (
        <AlertCircle className="jqs-jq-icon-sm jqs-jq-err" />
      )}
      <span className="jqs-jq-label">
        {result.success ? 'Output' : result.timedOut ? 'Timed out' : 'Error'}
      </span>
      {returns && <span className="jqs-jq-muted">must return {returns}</span>}
    </div>
    <pre
      className={clsx('jqs-jq-output', result.success ? 'jqs-jq-output--ok' : 'jqs-jq-output--err')}
    >
      {result.success ? result.output : result.error}
    </pre>
  </div>
);
