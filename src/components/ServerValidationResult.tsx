import { AlertCircle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import type { ServerValidationResult as ServerValidationVerdict } from '../declaration';

interface ServerValidationResultProps {
  result: ServerValidationVerdict;
}

/** The verdict from a host's server-side validator: an ok/failed header over an
 *  optional message. */
export const ServerValidationResult = ({ result }: ServerValidationResultProps) => (
  <div className="jqs-jq-field">
    <div className="jqs-jq-field__label-row">
      {result.ok ? (
        <CheckCircle2 className="jqs-jq-icon-sm jqs-jq-ok" />
      ) : (
        <AlertCircle className="jqs-jq-icon-sm jqs-jq-err" />
      )}
      <span className="jqs-jq-label">
        {result.ok ? 'Valid on server' : 'Server validation failed'}
      </span>
    </div>
    {result.message && (
      <pre
        className={clsx('jqs-jq-output', result.ok ? 'jqs-jq-output--ok' : 'jqs-jq-output--err')}
      >
        {result.message}
      </pre>
    )}
  </div>
);
