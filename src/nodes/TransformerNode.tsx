import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Position } from '@xyflow/react';
import clsx from 'clsx';
import { JQNodeType } from '../enums';
import { jqNodeColorVar } from '../colors';
import { JQ_KIND_REGISTRY, jqKindHasSharedHue } from '../jq-kind-registry';
import { useValidationErrors } from '../ValidationContext';
import { TransformerHandle } from './TransformerHandle';
import { NodeCardHeader } from './card/NodeCardHeader';
import { NodeErrorList } from './card/NodeErrorList';

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

/** The card's error severity: whether any problem holds, and whether they are all
 *  warnings (a warning-only card reads muted rather than as an error). */
const nodeErrorState = (errors: { severity: 'error' | 'warning' }[]) => {
  const hasErrors = errors.length > 0;
  return { hasErrors, hasWarningsOnly: hasErrors && errors.every((e) => e.severity === 'warning') };
};

/** The card's root class list: base card plus the comment / selection / severity
 *  modifiers (selection and error rings are ADDITIVE — they never drop the lift). */
const nodeCardClass = (
  nodeType: JQNodeType,
  selected: boolean,
  hasErrors: boolean,
  hasWarningsOnly: boolean,
): string =>
  clsx(
    'jqs-jq-node',
    nodeType === JQNodeType.Comment && 'jqs-jq-node--comment',
    selected && 'jqs-jq-node--selected',
    hasErrors && (hasWarningsOnly ? 'jqs-jq-node--warning' : 'jqs-jq-node--error'),
  );

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
    const { hasErrors, hasWarningsOnly } = nodeErrorState(errors);

    const accentStyle = { '--jqs-jq-accent': jqNodeColorVar[nodeType] } as CSSProperties;
    const badge = jqKindHasSharedHue(nodeType) ? JQ_KIND_REGISTRY[nodeType].badge : null;
    const diamond = nodeType === JQNodeType.Condition;
    const round = nodeType === JQNodeType.TryCatch;

    return (
      <div
        className={nodeCardClass(nodeType, selected, hasErrors, hasWarningsOnly)}
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

        <NodeCardHeader
          title={title}
          icon={icon}
          badge={badge}
          summary={summary}
          diamond={diamond}
          round={round}
          hasErrors={hasErrors}
          hasWarningsOnly={hasWarningsOnly}
        />

        {collapsed ? children : <div className="jqs-jq-node__form">{children}</div>}

        {!collapsed && hasErrors && <NodeErrorList errors={errors} />}

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
