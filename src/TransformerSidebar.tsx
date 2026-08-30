import { useMemo } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import clsx from 'clsx';
import { JQNodeType } from './enums';
import { JQ_KIND_REGISTRY } from './jq-kind-registry';
import { jqNodeColorVar } from './colors';
import { useTransformerConnection } from './TransformerContext';
import { getValidJQNodeTypesForConnection } from './utils/validator';

/**
 * The node palette. Every item's caption, glyph, and one-line gloss come from
 * the single jq kind registry (one vocabulary shared with the node cards and the
 * legend), grouped into the same Data / Logic / Functions / Notes sections the
 * flow palette uses. The disabled Input item states its reason inline.
 */
interface PaletteSection {
  readonly label: string;
  readonly kinds: readonly JQNodeType[];
}

const PALETTE_SECTIONS: readonly PaletteSection[] = [
  { label: 'Data', kinds: [JQNodeType.Start, JQNodeType.Value, JQNodeType.Operator] },
  { label: 'Logic', kinds: [JQNodeType.Condition, JQNodeType.TryCatch] },
  { label: 'Functions', kinds: [JQNodeType.FunctionCall, JQNodeType.FunctionDecl] },
  { label: 'Notes', kinds: [JQNodeType.Comment] },
];

interface TransformerSidebarProps {
  className?: string;
  hasStartNode?: boolean;
}

export const TransformerSidebar = ({
  className,
  hasStartNode = false,
}: TransformerSidebarProps) => {
  const { connectionState, addNode } = useTransformerConnection();

  const validNodeTypes = useMemo(() => {
    if (!connectionState.isConnecting || !connectionState.sourceNodeType) {
      return [];
    }
    return getValidJQNodeTypesForConnection(
      connectionState.sourceNodeType,
      connectionState.sourceHandleType,
      connectionState.sourceHandleId,
    );
  }, [connectionState]);

  const onDragStart = (event: DragEvent, nodeType: JQNodeType) => {
    event.dataTransfer.setData('application/transformer-node-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className={clsx('jqs-jq-palette', className)}>
      <h2 className="jqs-jq-palette__title">Node Types</h2>
      {PALETTE_SECTIONS.map((section) => (
        <div key={section.label} className="jqs-jq-palette__group">
          <span className="jqs-jq-palette__divider-label">{section.label}</span>
          {section.kinds.map((type) => {
            const entry = JQ_KIND_REGISTRY[type];
            const Icon = entry.icon;
            const isHighlighted = validNodeTypes.includes(type);
            // The root Input node is unique per expression.
            const isDisabled = type === JQNodeType.Start && hasStartNode;
            const style: CSSProperties = isHighlighted
              ? { borderColor: jqNodeColorVar[type], borderWidth: '2px' }
              : {};

            return (
              <button
                key={type}
                type="button"
                className={clsx(
                  'jqs-jq-palette__item',
                  connectionState.isConnecting && !isHighlighted && 'jqs-jq-palette__item--dimmed',
                )}
                style={style}
                draggable={!isDisabled}
                onDragStart={(e) => {
                  onDragStart(e, type);
                }}
                // Click (and thus Enter/Space on the focused button) adds the node
                // at the viewport centre — a keyboard-reachable path that does not
                // require a drag. Drag-to-place stays exactly as before.
                onClick={() => {
                  if (!isDisabled) addNode(type);
                }}
                disabled={isDisabled}
              >
                <span
                  className="jqs-jq-palette__item-icon"
                  style={{ backgroundColor: jqNodeColorVar[type] }}
                >
                  <Icon className="jqs-jq-icon-sm" />
                </span>
                <span className="jqs-jq-palette__item-body">
                  <span className="jqs-jq-palette__item-label">{entry.builderCaption}</span>
                  <span className="jqs-jq-palette__item-reason">
                    {isDisabled ? 'An expression has one Input node.' : entry.gloss}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
};
