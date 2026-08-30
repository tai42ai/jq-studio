import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { HandleProps } from '@xyflow/react';
import clsx from 'clsx';
import { Tooltip } from '../primitives';
import { JQNodeType, JQHandleIdPrefix } from '../enums';
import { jqNodeColorVar } from '../colors';
import { useTransformerConnection } from '../TransformerContext';
import { getValidJQNodeTypesForConnection } from '../utils/validator';
import { getJqHandleTooltip } from '../handle-tooltips';

interface TransformerHandleProps extends Omit<HandleProps, 'position'> {
  nodeId: string;
  nodeType: JQNodeType;
  position: Position;
  handleType: 'source' | 'target';
  isInner?: boolean;
  label?: string;
  /** Place the port label just OUTSIDE the card edge (a small pill on the canvas)
   *  rather than inside the card. Used on side rails whose in-card position would
   *  otherwise sit under the node's own content — an operator's `a` under the icon
   *  chip, a call's `arg n` under the title — or crowd a stack of sibling labels. */
  labelOutside?: boolean;
}

export const TransformerHandle = memo(
  ({
    nodeId,
    nodeType,
    position,
    handleType,
    isInner = false,
    label,
    labelOutside = false,
    id,
    ...props
  }: TransformerHandleProps) => {
    const { connectionState } = useTransformerConnection();

    const finalHandleId =
      id ??
      (isInner
        ? `${JQHandleIdPrefix.Inner}:${nodeId}`
        : handleType === 'source'
          ? JQHandleIdPrefix.Bottom
          : JQHandleIdPrefix.Top);

    const isValidConnectionTarget = useMemo(() => {
      if (!connectionState.isConnecting) return false;
      if (connectionState.sourceNodeId === nodeId) return false;
      if (connectionState.sourceHandleType === handleType) return false;

      const validTypes = getValidJQNodeTypesForConnection(
        connectionState.sourceNodeType,
        connectionState.sourceHandleType,
        connectionState.sourceHandleId,
      );

      return validTypes.includes(nodeType);
    }, [connectionState, nodeId, nodeType, handleType]);

    const sourceColor = connectionState.sourceNodeType
      ? jqNodeColorVar[connectionState.sourceNodeType]
      : undefined;

    const muted =
      connectionState.isConnecting &&
      !isValidConnectionTarget &&
      connectionState.sourceNodeId !== nodeId;

    // The base dot fill comes from CSS (`--jqs-jq-accent`, the owning card's
    // accent), so only the valid-drop-target GLOW is styled inline — it paints
    // in the colour of the node the drag started from.
    const dynamicStyles = useMemo<CSSProperties | undefined>(() => {
      if (isValidConnectionTarget && sourceColor) {
        return {
          backgroundColor: sourceColor,
          boxShadow: `0 0 10px 3px ${sourceColor}`,
          borderColor: sourceColor,
        };
      }
      return undefined;
    }, [isValidConnectionTarget, sourceColor]);

    const handle = (
      <Handle
        {...props}
        id={finalHandleId}
        type={handleType}
        position={position}
        className={clsx('jqs-jq-handle', muted && 'jqs-jq-handle--muted')}
        style={dynamicStyles}
      />
    );

    // Hover explanation of what this handle connects to. Skipped while a
    // connection is being drawn so the tooltip never covers a drop target.
    const tooltip = getJqHandleTooltip(nodeType, finalHandleId);
    const wrappedHandle =
      tooltip && !connectionState.isConnecting ? (
        <Tooltip
          delayDuration={300}
          content={
            // The primitives `Tooltip` portals outside the library root, so the
            // content wrapper re-stamps the root class to keep scoped styles applying.
            <div className="jq-studio-root jqs-jq-handle-tip">
              <p className="jqs-jq-handle-tip__title">{tooltip.title}</p>
              <p className="jqs-jq-handle-tip__body">{tooltip.body}</p>
            </div>
          }
        >
          {handle}
        </Tooltip>
      ) : (
        handle
      );

    return (
      <div
        className={clsx(
          'jqs-jq-handle-wrap',
          position === Position.Right && 'jqs-jq-handle-wrap--reverse',
        )}
      >
        {label && (
          <span
            className={clsx(
              'jqs-jq-handle-label',
              position === Position.Right
                ? 'jqs-jq-handle-label--right'
                : 'jqs-jq-handle-label--left',
              position === Position.Top && 'jqs-jq-handle-label--top',
              position === Position.Bottom && 'jqs-jq-handle-label--bottom',
              labelOutside && 'jqs-jq-handle-label--outside',
            )}
          >
            {label}
          </span>
        )}
        {wrappedHandle}
      </div>
    );
  },
);

TransformerHandle.displayName = 'TransformerHandle';
