import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { memo } from 'react';

import type { ValidationError } from '../../utils/flow-validator';

interface NodeErrorListProps {
  errors: ValidationError[];
}

/** The node card's problem list: one row per validation error, tinted by
 *  severity (warning rows read muted, error rows read loud). */
export const NodeErrorList = memo(({ errors }: NodeErrorListProps) => (
  <div className="jqs-jq-node__errors">
    {errors.map((err, i) => (
      <div
        key={i}
        className={clsx(
          'jqs-jq-node__error',
          err.severity === 'warning' && 'jqs-jq-node__error--warning',
        )}
      >
        <AlertTriangle className="jqs-jq-node__error-icon" />
        <span>{err.message}</span>
      </div>
    ))}
  </div>
));

NodeErrorList.displayName = 'NodeErrorList';
