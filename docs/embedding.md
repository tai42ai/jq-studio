# Embedding guide (deep integration)

For most apps [`JqField`](quickstart.md) is enough. When you need to own the
field chrome, control when the editor opens, or use the converters and guard
directly, reach for the lower-level surface below.

## `JqEditorDialog`

The full-screen visual editor as a controlled dialog. (`JqEditorDialog` is an
alias of `JQEditorDialog`; both are exported.)

```tsx
import { useState } from 'react';
import { JqEditorDialog, installDefaultJqWorker } from '@tai42/jq-studio';
import '@tai42/jq-studio/styles.css';

installDefaultJqWorker(); // once, at startup, if you are not using JqField

function EditExpression({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Edit</button>
      <JqEditorDialog
        open={open}
        initialExpression={value}
        fieldLabel="Transform"
        onSave={(expr) => {
          onChange(expr);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
```

### `JQEditorDialogProps`

| Prop                | Type                           | Notes                                                |
| ------------------- | ------------------------------ | ---------------------------------------------------- |
| `open`              | `boolean`                      | Controlled open state.                               |
| `initialExpression` | `string`                       | The expression the editor loads.                     |
| `fieldLabel`        | `string`                       | Shown in the dialog title.                           |
| `shape`             | `JqInputShapeDescriptor`       | What `.` is (context chip + Test-panel sample).      |
| `serverValidate`    | `ServerValidateHook`           | Host validator for the Test panel.                   |
| `onSave`            | `(expression: string) => void` | Called when the user saves.                          |
| `onClose`           | `() => void`                   | Called on cancel / Escape / overlay (dirty-guarded). |
| `readOnly`          | `boolean`                      | Open as a viewer.                                    |

The editor installs no worker of its own — call `installDefaultJqWorker()` once at
startup, or provide your own via `setJqWorkerFactory` (see
[worker & CSP](worker-csp.md)). `JqField` does this for you.

## The field declaration types

A host describes a field with generic, host-agnostic types — no shape enum is
hard-coded, so any `.` document is expressible:

- `JqFieldDeclaration` — `{ language, shape?, sampleInput?, serverValidate? }`.
- `JqInputShapeDescriptor` — `{ id, label, blurb, keys, returns, caveats?, sample? }`.
- `JqInputKey` — `{ name, gloss }`.
- `SampleInputProvider` — `() => unknown`.
- `ServerValidateHook` — `(args: { expression, sampleInput }) => Promise<ServerValidationResult>`.
- `ServerValidationResult` — `{ ok, compiles?, singleEmit?, message? }`.

```ts
const declaration: JqFieldDeclaration = {
  language: 'jq',
  shape: {
    id: 'my-app:record',
    label: 'record',
    blurb: 'A record.',
    keys: [],
    returns: 'an object',
  },
  serverValidate: async ({ expression, sampleInput }) => {
    const res = await fetch('/api/validate-jq', {
      method: 'POST',
      body: JSON.stringify({ expression, sampleInput }),
    });
    return (await res.json()) as ServerValidationResult;
  },
};
```

## Round-trip converters

Convert between jq text and the node graph directly:

```ts
import { convertJQToFlow, convertFlowToJQ } from '@tai42/jq-studio';

const { nodes, edges } = convertJQToFlow('.a + .b');
const text = convertFlowToJQ(nodes, edges); // faithful re-serialization
```

`convertJQToFlow` throws `Unable to parse jq expression: …` for constructs the
visual language cannot draw — that is a normal, expected outcome, not a bug in the
expression.

## The faithfulness guard

The guard decides whether the visual editor can represent an expression without
changing its behaviour, checked against the real jq runtime:

```ts
import { roundTripVerdict, canRepresentFaithfully, checkJqValidity } from '@tai42/jq-studio';

await roundTripVerdict('.a + .b'); // 'faithful' | 'unfaithful' | 'unparseable'
await canRepresentFaithfully('.a + .b'); // cheap boolean: default this field to the visual door?
await checkJqValidity('.a +'); // 'valid' | 'invalid' — does the jq compile at all?
```

`TransformerPreview` is a static, read-only tile that uses the guard to draw a
graph only when it is proven faithful, and a neutral notice otherwise. Mount it
under a `.jq-studio-root` element so the scoped styles apply.

## The static preview + editor body

- `TransformerPreview` — the read-only thumbnail described above.
- `TransformerEditor` — the editor body (canvas + panels) without the dialog
  chrome, for hosts that supply their own modal.
- `JQEditorProvider` / `useJQEditorState` — an open-gate a surrounding editor
  reads to mute its own shortcuts while a jq editor is open.
