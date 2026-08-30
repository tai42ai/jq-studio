/**
 * The transformer canvas edge renderer: a bezier wire stroked with a gradient
 * from the source node's colour to the target's.
 *
 * The two ends carry their NODE TYPES on the edge `data` (`sourceType` /
 * `targetType`, enriched from the live nodes by the canvas), and the colours are
 * resolved HERE from the kind registry — so a node never strands a stale baked
 * colour, and the converter layer stays free of styling. (Legacy `fromColor` /
 * `toColor` token strings are still honoured as a fallback.)
 *
 * A 14px transparent HIT PATH makes the 2px strand pointable; hover or selection
 * emphasises it (+1.5 stroke and a soft focus-ring halo) so one wire stays
 * traceable through a dense expression tree.
 */
import { memo, useState } from 'react';
import { getBezierPath, Position, type EdgeProps } from '@xyflow/react';
import { JQNodeType } from './enums';
import { jqNodeColorVar } from './colors';

/** The React Flow edge `type` value this renderer registers under. */
export const JQ_GRADIENT_EDGE_TYPE = 'gradient';

const FALLBACK_COLOR = 'var(--jq-color-text-muted)';

/**
 * A source handle sits on a fixed side of its card, but the node it feeds can be
 * laid out on ANY side — e.g. the Start node's right-facing "Flow" handle whose
 * main-pipeline successor the loader places directly BELOW it. Trusting that
 * declared side then makes `getBezierPath` push its control point the wrong way
 * and fold the wire back on itself in a cusp (the stray red hook by the Input
 * node). When a handle's declared side points AWAY from the other endpoint,
 * re-derive the exit direction from the dominant axis of the real gap so the wire
 * always leaves toward its partner; a side already facing the partner is kept
 * untouched, so well-behaved wires stay exactly as before.
 */
export const resolveExitPosition = (
  declared: Position,
  x: number,
  y: number,
  partnerX: number,
  partnerY: number,
): Position => {
  const pointsAway =
    (declared === Position.Right && partnerX < x) ||
    (declared === Position.Left && partnerX > x) ||
    (declared === Position.Top && partnerY > y) ||
    (declared === Position.Bottom && partnerY < y);
  if (!pointsAway) return declared;
  const dx = partnerX - x;
  const dy = partnerY - y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? Position.Bottom : Position.Top;
  return dx >= 0 ? Position.Right : Position.Left;
};

const isJqNodeType = (value: unknown): value is JQNodeType =>
  typeof value === 'string' && (Object.values(JQNodeType) as string[]).includes(value);

/** Resolve an end's colour: from its node type via the registry, else a legacy
 *  baked token string, else muted. */
const endColor = (nodeType: unknown, legacy: unknown): string => {
  if (isJqNodeType(nodeType)) return jqNodeColorVar[nodeType];
  if (typeof legacy === 'string') return legacy;
  return FALLBACK_COLOR;
};

export const JqGradientEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    data,
    selected,
  }: EdgeProps) => {
    // Hover is tracked on the wide transparent hit path (a 2px stroke is
    // near-impossible to point at); hover or selection emphasises the strand.
    const [hovered, setHovered] = useState(false);
    // The target is a canonical Top entry point every wire meets head-on, so only
    // the SOURCE exit is re-routed toward its partner — that alone removes the
    // fold without disturbing where wires land.
    const [edgePath] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition: resolveExitPosition(sourcePosition, sourceX, sourceY, targetX, targetY),
      targetX,
      targetY,
      targetPosition,
    });

    const fromColor = endColor(data?.sourceType, data?.fromColor);
    const toColor = endColor(data?.targetType, data?.toColor);
    const baseWidth = typeof data?.strokeWidth === 'number' ? data.strokeWidth : 2;
    const emphasized = hovered || selected === true;
    const strokeWidth = emphasized ? baseWidth + 1.5 : baseWidth;
    const animate = data?.animate === true;

    return (
      <>
        <defs>
          <linearGradient
            id={`jqs-jq-edge-gradient-${id}`}
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={fromColor} />
            <stop offset="100%" stopColor={toColor} />
          </linearGradient>
        </defs>

        {emphasized ? (
          // A soft halo under the emphasised strand lifts it out of a bundle
          // without occluding neighbours.
          <path
            d={edgePath}
            stroke="var(--jq-color-focus-ring)"
            strokeWidth={strokeWidth + 4}
            strokeLinecap="round"
            fill="none"
            opacity={0.35}
          />
        ) : null}
        <path
          d={edgePath}
          stroke={`url(#jqs-jq-edge-gradient-${id})`}
          strokeWidth={strokeWidth}
          fill="none"
          markerEnd={markerEnd}
          style={{
            animation: animate ? 'jqs-jq-edge-dash 0.8s linear infinite' : undefined,
            strokeDasharray: animate ? 5 : undefined,
            transition: 'stroke-width 80ms ease',
          }}
        />
        {/* Invisible fat hit path: makes the strand hoverable/clickable. */}
        <path
          d={edgePath}
          stroke="transparent"
          strokeWidth={14}
          fill="none"
          onMouseEnter={() => {
            setHovered(true);
          }}
          onMouseLeave={() => {
            setHovered(false);
          }}
          style={{ pointerEvents: 'stroke' }}
        />
      </>
    );
  },
);

JqGradientEdge.displayName = JQ_GRADIENT_EDGE_TYPE;
