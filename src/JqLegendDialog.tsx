/**
 * The canvas legend: one row per jq node kind (glyph chip, build caption, kind
 * badge, gloss) plus an edge-notation key, generated from the single kind
 * registry so it can never drift from what the canvas paints. Opened from the
 * editor toolbar (mirrors the flow canvas's Legend affordance).
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { BookOpen } from 'lucide-react';
import clsx from 'clsx';
import { Button, Dialog } from './primitives';
import { JQ_KIND_REGISTRY, legendJqKindRows, jqKindHasSharedHue } from './jq-kind-registry';
import { JQNodeType } from './enums';

/** The primitives `Dialog` portals its content to `document.body`, outside this
 *  library's `.jq-studio-root` scope. Hanging the root class on the content
 *  element (via `contentClassName`, exactly as JqTestPanel / JQEditorDialog do)
 *  re-enters the scope so the legend's scoped `jqs-jq-legend*` styles and the
 *  theme vars actually apply inside the portal — without it every scoped rule is
 *  dropped and the legend renders unstyled in both themes. */
const EDITOR_ROOT_CLASS = 'jq-studio-root';

/** Edge-notation rows — what the wire colours/shapes mean on the canvas. */
const NOTATION_ROWS: { label: string; body: string }[] = [
  { label: 'Pipe', body: 'A wire carries one node’s result into the next.' },
  { label: 'Operand', body: 'A side wire feeds the left/right side of an operator.' },
  { label: 'Function grant', body: 'A wire from Input to a Define Function makes it callable.' },
  {
    label: 'Role label',
    body: 'Branching cards label their exits — a Condition’s if / then / else, a Try/Catch’s try / catch, a Define Function’s body — and each wire repeats that role in a small chip at its start.',
  },
  {
    label: 'Slot label',
    body: 'Order- and key-bearing ports name their slot on the card: an Operator’s a / b operands, a Call’s parameter names (or arg 1…n), an object’s keys and an array’s [i] indices — so a crossed wire never silently changes meaning.',
  },
];

export const JqLegendDialog = () => {
  const [open, setOpen] = useState(false);
  const rows = legendJqKindRows();

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        <BookOpen className="jqs-jq-icon" />
        Legend
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Legend"
        description="What each node kind and wire means on the jq canvas"
        contentClassName={EDITOR_ROOT_CLASS}
      >
        <div className="jqs-jq-legend">
          <div className="jqs-jq-legend__section-label">Node kinds</div>
          {rows.map((row) => {
            const Icon = row.icon;
            const accent = JQ_KIND_REGISTRY[row.kind].color;
            const chipStyle = { '--jqs-jq-accent': accent } as CSSProperties;
            const diamond = row.kind === JQNodeType.Condition;
            const round = row.kind === JQNodeType.TryCatch;
            return (
              <div key={row.kind} className="jqs-jq-legend__row" style={chipStyle}>
                <span
                  className={clsx(
                    'jqs-jq-legend__chip',
                    diamond && 'jqs-jq-node__icon--diamond',
                    round && 'jqs-jq-node__icon--round',
                  )}
                >
                  <Icon className="jqs-jq-icon-sm" />
                </span>
                <div className="jqs-jq-legend__text">
                  <div className="jqs-jq-legend__caption">
                    {row.caption}
                    {jqKindHasSharedHue(row.kind) && (
                      <span className="jqs-jq-node__kind-badge">{row.badge}</span>
                    )}
                  </div>
                  <div className="jqs-jq-legend__gloss">{row.gloss}</div>
                </div>
              </div>
            );
          })}

          <div className="jqs-jq-legend__section-label">Wires</div>
          {NOTATION_ROWS.map((row) => (
            <div key={row.label} className="jqs-jq-legend__row">
              <span className="jqs-jq-legend__wire" aria-hidden />
              <div className="jqs-jq-legend__text">
                <div className="jqs-jq-legend__caption">{row.label}</div>
                <div className="jqs-jq-legend__gloss">{row.body}</div>
              </div>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
};
