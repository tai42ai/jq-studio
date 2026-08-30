# Quickstart

`JqField` is the drop-in for the common case: a labelled jq expression field that
opens a full visual editor. Everything is wired by default — the WASM runtime
loads lazily, and the evaluation worker installs itself on mount.

## Install

```bash
npm install @tai42/jq-studio react react-dom
```

`react` and `react-dom` are peer dependencies (`^18` or `^19`); your app already
provides them.

## Use

```tsx
import { useState } from 'react';
import { JqField } from '@tai42/jq-studio';
import '@tai42/jq-studio/styles.css';

export function TransformField() {
  const [expr, setExpr] = useState('.items | map(.name)');
  return <JqField label="Transform" value={expr} onChange={setExpr} />;
}
```

That is the whole integration. The **Visual editor** button opens the canvas; the
user edits the graph and saves; the new expression comes back through `onChange`.

## `JqFieldProps`

| Prop                 | Type                      | Default | Notes                                                                                                                                                                                  |
| -------------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`              | `string`                  | —       | Visible label; also the editor dialog's title.                                                                                                                                         |
| `value`              | `string`                  | —       | The current jq expression (controlled).                                                                                                                                                |
| `onChange`           | `(value: string) => void` | —       | Called on a resting-control edit and on a visual-editor save.                                                                                                                          |
| `shape`              | `JqInputShapeDescriptor`  | —       | What `.` is for this field (drives the context chip + Test-panel sample).                                                                                                              |
| `sampleInput`        | `SampleInputProvider`     | —       | Live sample for the Test panel; overrides `shape.sample` when it returns a defined value.                                                                                              |
| `serverValidate`     | `ServerValidateHook`      | —       | Optional host validator surfaced in the Test panel.                                                                                                                                    |
| `multiline`          | `boolean`                 | `false` | Render a textarea instead of a single-line input for the resting control.                                                                                                              |
| `compact`            | `boolean`                 | `false` | Density variant for dense host rows: visually-hides the label (accessible name + `htmlFor` kept) and collapses the door to icon-only (full aria-label kept); tightens vertical rhythm. |
| `readOnly`           | `boolean`                 | `false` | Show read-only; the visual editor opens as a viewer.                                                                                                                                   |
| `placeholder`        | `string`                  | —       | Placeholder for the resting control.                                                                                                                                                   |
| `id`                 | `string`                  | auto    | id for the resting control (for an external `<label htmlFor>`).                                                                                                                        |
| `description`        | `ReactNode`               | —       | Helper text under the control, linked via `aria-describedby`.                                                                                                                          |
| `error`              | `ReactNode`               | —       | Error under the control (`role="alert"`); linked via `aria-describedby` and sets `aria-invalid`.                                                                                       |
| `onEditorOpenChange` | `(open: boolean) => void` | —       | Called on every editor open-state transition; a host mutes global keydown shortcuts while open.                                                                                        |

## Describing `.` with a shape

A shape descriptor tells the editor what document the expression receives, so it
can show a context chip and seed the Test panel:

```tsx
<JqField
  label="Alert body"
  value={expr}
  onChange={setExpr}
  shape={{
    id: 'my-app:event',
    label: 'event envelope',
    blurb: 'The event `.` your expression transforms.',
    keys: [
      { name: 'id', gloss: 'the event id' },
      { name: 'payload', gloss: 'the event body' },
    ],
    returns: 'an object',
    sample: { id: 'evt_1', payload: { level: 'warn' } },
  }}
/>
```

Every field of `JqInputShapeDescriptor` beyond `id`/`label`/`blurb`/`keys`/`returns`
is optional. See the [embedding guide](embedding.md) for `serverValidate` and the
lower-level surfaces.

## Styling

Import `@tai42/jq-studio/styles.css` once. It ships a self-contained light + dark
theme (following `prefers-color-scheme`, overridable with `data-theme`). To match
your palette, redefine `--jq-*` tokens — see the [theme contract](theme-contract.md).

## A runnable example

[`e2e/`](../e2e/) is a bare Vite consumer app that mounts `JqField` and is also
the repo's browser test harness. Run it with `pnpm --dir e2e dev` after building
the package (`pnpm build`).
