import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';

interface NodeCardHeaderProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  summary?: ReactNode;
  diamond: boolean;
  round: boolean;
  hasErrors: boolean;
  hasWarningsOnly: boolean;
}

/** The card's icon chip and text block: the kind's small TYPE LABEL (with an
 *  optional disambiguating kind badge and a problem alert) over the node's own
 *  content promoted to the prominent NAME slot. */
export const NodeCardHeader = memo(
  ({
    title,
    icon,
    badge,
    summary,
    diamond,
    round,
    hasErrors,
    hasWarningsOnly,
  }: NodeCardHeaderProps) => (
    <div className="jqs-jq-node__body">
      {icon && (
        <div
          className={clsx(
            'jqs-jq-node__icon',
            diamond && 'jqs-jq-node__icon--diamond',
            round && 'jqs-jq-node__icon--round',
          )}
        >
          {icon}
        </div>
      )}
      <div className="jqs-jq-node__text">
        <h2 className="jqs-jq-node__type-label">
          <span className="jqs-jq-node__type-name">{title}</span>
          {badge && <span className="jqs-jq-node__kind-badge">{badge}</span>}
          {hasErrors && (
            <AlertTriangle
              className={clsx(
                'jqs-jq-node__title-alert',
                hasWarningsOnly && 'jqs-jq-node__title-alert--warning',
              )}
              aria-label={hasWarningsOnly ? 'Node has warnings' : 'Node has errors'}
            />
          )}
        </h2>
        {summary && <h3 className="jqs-jq-node__name">{summary}</h3>}
      </div>
    </div>
  ),
);

NodeCardHeader.displayName = 'NodeCardHeader';
