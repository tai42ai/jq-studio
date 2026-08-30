/**
 * The ONE jq node-KIND registry: a single source describing every kind the jq
 * canvas renders — builder caption, plain (reading-mode) caption, chrome colour,
 * glyph, kind badge, and legend gloss. The palette, node chrome, minimap, and
 * legend all read identity from here, so a kind's label/colour/icon has one home
 * (mirrors the flow canvas's `NODE_KIND_REGISTRY`, restoring cross-canvas
 * semantics).
 *
 * Colour anchors (shared with the flow canvas so a hue means the same thing in
 * both editors):
 *   - `primary`      = entry / callable   (Input, Call Function, Define Function)
 *   - `warning`      = decision           (Condition)
 *   - `danger`       = error recovery     (Try/Catch)
 *   - `text-muted`   = plain data / note  (Value, Operator, Comment)
 * Kinds that share a hue are told apart by glyph, shape modifier, and badge.
 *
 * Fork rulings baked in (F1): Operator is muted (data, shape/icon differentiate),
 * Define Function is primary with a `Def` badge. Fork F5: the root node is
 * captioned "Input", not "Start".
 *
 * English only.
 */
import type { ComponentType, CSSProperties } from 'react';
import {
  Calculator,
  Code2,
  FunctionSquare,
  GitBranch,
  Hash,
  LogIn,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { JQNodeType } from './enums';

/** Props every kind glyph accepts (a lucide component). */
export interface JqKindIconProps {
  className?: string;
  style?: CSSProperties;
}

/** A kind glyph component. */
export type JqKindIcon = ComponentType<JqKindIconProps>;

/** One registry entry — every facet of a jq kind's identity in one place. */
export interface JqKindEntry {
  /** Build-mode caption (palette item + node card title). One vocabulary: the
   *  palette label and the card caption are the same string. */
  readonly builderCaption: string;
  /** Reading-mode plain-English caption (legend / prose surfaces). */
  readonly plainCaption: string;
  /** Chrome colour as a design-system custom property (`var(--jq-color-*)`). */
  readonly color: string;
  /** Default kind glyph. */
  readonly icon: JqKindIcon;
  /** Terse kind badge. */
  readonly badge: string;
  /** One-line legend gloss: what the kind does. */
  readonly gloss: string;
}

/**
 * The single kind table. One entry per `JQNodeType`.
 */
export const JQ_KIND_REGISTRY: Record<JQNodeType, JqKindEntry> = {
  [JQNodeType.Start]: {
    builderCaption: 'Input',
    plainCaption: 'Input',
    color: 'var(--jq-color-primary)',
    icon: LogIn,
    badge: 'In',
    gloss: 'The data this expression receives — `.`.',
  },
  [JQNodeType.Value]: {
    builderCaption: 'Value',
    plainCaption: 'Value',
    color: 'var(--jq-color-text-muted)',
    icon: Hash,
    badge: 'Val',
    gloss: 'A literal or a path into the input.',
  },
  [JQNodeType.Operator]: {
    builderCaption: 'Operator',
    plainCaption: 'Operator',
    color: 'var(--jq-color-text-muted)',
    icon: Calculator,
    badge: 'Op',
    gloss: 'Combines two values (+, ==, //, …).',
  },
  [JQNodeType.Condition]: {
    builderCaption: 'Condition',
    plainCaption: 'Decision',
    color: 'var(--jq-color-warning)',
    icon: GitBranch,
    badge: 'If',
    gloss: 'Chooses a result with if / else.',
  },
  [JQNodeType.TryCatch]: {
    builderCaption: 'Try/Catch',
    plainCaption: 'Recovery',
    color: 'var(--jq-color-danger)',
    icon: ShieldAlert,
    badge: 'Try',
    gloss: 'Runs logic and recovers on error.',
  },
  [JQNodeType.FunctionCall]: {
    builderCaption: 'Call Function',
    plainCaption: 'Function',
    color: 'var(--jq-color-primary)',
    icon: FunctionSquare,
    badge: 'Fn',
    gloss: 'Applies a built-in or defined function.',
  },
  [JQNodeType.FunctionDecl]: {
    builderCaption: 'Define Function',
    plainCaption: 'Definition',
    color: 'var(--jq-color-primary)',
    icon: Code2,
    badge: 'Def',
    gloss: 'Declares a reusable function.',
  },
  [JQNodeType.Comment]: {
    builderCaption: 'Comment',
    plainCaption: 'Comment',
    color: 'var(--jq-color-text-muted)',
    icon: MessageSquare,
    badge: '#',
    gloss: 'A note; never runs.',
  },
};

/**
 * Every jq node kind in presentation order (Data → Logic → Functions → Notes),
 * matching the palette's section order. The palette, legend, and any
 * kind-enumerating surface iterate this so ordering has one home.
 */
export const ALL_JQ_NODE_KINDS: readonly JQNodeType[] = [
  JQNodeType.Start,
  JQNodeType.Value,
  JQNodeType.Operator,
  JQNodeType.Condition,
  JQNodeType.TryCatch,
  JQNodeType.FunctionCall,
  JQNodeType.FunctionDecl,
  JQNodeType.Comment,
];

/**
 * Kinds whose chrome hue is SHARED with another kind. These render a kind badge
 * (the `.jqs-jq-node__kind-badge` idiom, mirroring the flow canvas's derived-kind
 * badge) so cards that would otherwise read as the same colour stay tellable
 * apart by a terse label. A kind with a UNIQUE hue leans on colour + glyph +
 * shape modifier alone and shows no badge. Derived from the registry so the set
 * can never drift from the colour assignments.
 */
export const JQ_SHARED_HUE_KINDS: ReadonlySet<JQNodeType> = (() => {
  const counts = new Map<string, number>();
  for (const kind of ALL_JQ_NODE_KINDS) {
    const color = JQ_KIND_REGISTRY[kind].color;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return new Set(
    ALL_JQ_NODE_KINDS.filter((kind) => (counts.get(JQ_KIND_REGISTRY[kind].color) ?? 0) > 1),
  );
})();

/** Whether a kind shares its hue with another and so wears a disambiguating
 *  badge (Input / Call Function / Define Function on primary; Value / Operator /
 *  Comment on muted). */
export const jqKindHasSharedHue = (kind: JQNodeType): boolean => JQ_SHARED_HUE_KINDS.has(kind);

/** One legend row per kind: the glyph, its build caption, and its gloss. The
 *  legend dialog renders these; generated from the registry so it can never
 *  drift from what the canvas paints. */
export interface JqLegendRow {
  readonly kind: JQNodeType;
  readonly caption: string;
  readonly plainCaption: string;
  readonly icon: JqKindIcon;
  readonly badge: string;
  readonly gloss: string;
}

/** The legend rows, in presentation order. */
export function legendJqKindRows(): JqLegendRow[] {
  return ALL_JQ_NODE_KINDS.map((kind) => {
    const entry = JQ_KIND_REGISTRY[kind];
    return {
      kind,
      caption: entry.builderCaption,
      plainCaption: entry.plainCaption,
      icon: entry.icon,
      badge: entry.badge,
      gloss: entry.gloss,
    };
  });
}
