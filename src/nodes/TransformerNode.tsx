import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Position } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { JQNodeType } from '../enums';
import { jqNodeColorVar } from '../colors';
import { JQ_KIND_REGISTRY, jqKindHasSharedHue } from '../jq-kind-registry';
import { useValidationErrors } from '../ValidationContext';
import { TransformerHandle } from './TransformerHandle';

interface TransformerNodeProps {
  id: string;
  nodeType: JQNodeType;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  selected?: boolean;
  collapsed?: boolean;
  summary?: ReactNode;
  hasTargetHandle?: boolean;
  hasSourceHandle?: boolean;
}

/**
 * The shared jq node card. It ports the flow canvas's `.jqs-node` grammar: a
 * neutral raised card with a transparent border, an accent-filled icon chip, the
 * kind name as a small accent TYPE LABEL, and the node's own content promoted to
 * the prominent NAME slot — the emphasis flow cards use (type small, content
 * big). The per-node accent is bound once as `--jqs-jq-accent` and read by the
 * chip, the selection border, and the badge. Selection and error rings are
 * ADDITIVE (they never drop the card's lift). Kinds that share a hue wear a
 * disambiguating kind badge; Condition/Try-Catch carry their flow-parity shape
 * modifiers (diamond / round) on the chip.
 */
export const TransformerNode = memo(
  ({
    id,
    nodeType,
    title,
    icon,
    children,
    selected = false,
    collapsed = false,
    summary,
    hasTargetHandle = true,
    hasSourceHandle = true,
  }: TransformerNodeProps) => {
    const errors = useValidationErrors(id);
    const hasErrors = errors.length > 0;
    const hasWarningsOnly = hasErrors && errors.every((e) => e.severity === 'warning');

    const accentStyle = { '--jqs-jq-accent': jqNodeColorVar[nodeType] } as CSSProperties;
    const badge = jqKindHasSharedHue(nodeType) ? JQ_KIND_REGISTRY[nodeType].badge : null;
    const diamond = nodeType === JQNodeType.Condition;
    const round = nodeType === JQNodeType.TryCatch;

    return (
      <div
        className={clsx(
          'jqs-jq-node',
          nodeType === JQNodeType.Comment && 'jqs-jq-node--comment',
          selected && 'jqs-jq-node--selected',
          hasErrors && (hasWarningsOnly ? 'jqs-jq-node--warning' : 'jqs-jq-node--error'),
        )}
        style={accentStyle}
      >
        {hasTargetHandle && (
          <div className="jqs-jq-node__handle jqs-jq-node__handle--top">
            <TransformerHandle
              nodeId={id}
              nodeType={nodeType}
              position={Position.Top}
              type="target"
              handleType="target"
            />
          </div>
        )}

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

        {collapsed ? children : <div className="jqs-jq-node__form">{children}</div>}

        {!collapsed && hasErrors && (
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
        )}

        {hasSourceHandle && (
          <div className="jqs-jq-node__handle jqs-jq-node__handle--bottom">
            <TransformerHandle
              nodeId={id}
              nodeType={nodeType}
              position={Position.Bottom}
              type="source"
              handleType="source"
            />
          </div>
        )}
      </div>
    );
  },
);

TransformerNode.displayName = 'TransformerNode';
