import { Position } from '@xyflow/react';
import { JQNodeType } from '../enums';
import { jqPortLabel } from '../handle-tooltips';
import { TransformerHandle } from './TransformerHandle';

export interface CollapsedHandleConfig {
  id: string;
  position: Position.Left | Position.Right;
  type: 'source' | 'target';
  handleType: 'source' | 'target';
  /** A node-supplied edge label that overrides the id-derived `jqPortLabel` —
   *  used where the role can only be named by the node itself (an operator's
   *  `a` / `b` operand sides, an object field's key text, an array item's index,
   *  a call arg's real parameter name). Omit it to fall back to the id-derived
   *  label (control-flow roles, positional-arg ordinals), or leave both empty for
   *  an unambiguous data port that stays bare. */
  label?: string;
}

interface CollapsedHandlesProps {
  nodeId: string;
  nodeType: JQNodeType;
  handles: CollapsedHandleConfig[];
}

/**
 * Renders all side handles stacked along the card edge for collapsed nodes.
 * Left handles stack at the left edge, right handles at the right edge.
 *
 * Role-bearing ports (a Condition's `if` / `then` / `else`, a Try/Catch's
 * `try` / `catch`, Define Function's `body`, an operator's `a` / `b`, a call's
 * `arg n`) show a small muted label as a pill just OUTSIDE the card edge — its
 * text is node-supplied or derived from the handle id via `jqPortLabel` — so the
 * decision structure is glanceable without selecting the card or hovering each
 * dot. Placing the pill OUTSIDE the edge (not inside) keeps it clear of the
 * card's own content (the operator icon, the call title) and of the wire's start,
 * so a port is named exactly ONCE with no duplicate edge chip. Single-role data
 * ports resolve to `null` and stay bare.
 */
export const CollapsedHandles = ({ nodeId, nodeType, handles }: CollapsedHandlesProps) => {
  const leftHandles = handles.filter((h) => h.position === Position.Left);
  const rightHandles = handles.filter((h) => h.position === Position.Right);

  if (leftHandles.length === 0 && rightHandles.length === 0) return null;

  return (
    <>
      {leftHandles.length > 0 && (
        <div className="jqs-jq-node__collapsed-handles jqs-jq-node__collapsed-handles--left">
          {leftHandles.map((h) => (
            <TransformerHandle
              key={h.id}
              nodeId={nodeId}
              nodeType={nodeType}
              position={h.position}
              type={h.type}
              handleType={h.handleType}
              id={h.id}
              label={h.label ?? jqPortLabel(h.id) ?? ''}
              labelOutside
            />
          ))}
        </div>
      )}
      {rightHandles.length > 0 && (
        <div className="jqs-jq-node__collapsed-handles jqs-jq-node__collapsed-handles--right">
          {rightHandles.map((h) => (
            <TransformerHandle
              key={h.id}
              nodeId={nodeId}
              nodeType={nodeType}
              position={h.position}
              type={h.type}
              handleType={h.handleType}
              id={h.id}
              label={h.label ?? jqPortLabel(h.id) ?? ''}
              labelOutside
            />
          ))}
        </div>
      )}
    </>
  );
};
