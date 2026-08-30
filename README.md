# @tai42/jq-studio

A standalone, embeddable **visual jq editor** for React: a node canvas that reads
a [jq](https://jqlang.github.io/jq/) expression into an editable graph and writes
it back, round-trip AST converters, a faithfulness guard that keeps the editor
from ever adopting an expression it reads wrong, the jq-web WASM runtime for
in-browser evaluation, and a drop-in `JqField`.

It depends on **no design system** and **no host**. It renders through nine small
built-in primitives, and a host can substitute its own components through
`PrimitivesProvider` — so the same package serves the tai42 Studio SDK and any
third-party app alike. It is published to npm and licensed **Apache-2.0**.

## Install

```bash
npm install @tai42/jq-studio
# peers you already have in a React app:
npm install react react-dom
```

```ts
import { JqField } from '@tai42/jq-studio';
import '@tai42/jq-studio/styles.css';
```

## Quickstart — `JqField` in five lines

```tsx
import { useState } from 'react';
import { JqField } from '@tai42/jq-studio';
import '@tai42/jq-studio/styles.css';

export function Example() {
  const [expr, setExpr] = useState('.items | map(.name)');
  return <JqField label="Transform" value={expr} onChange={setExpr} />;
}
```

`JqField` renders a labelled text control plus a **Visual editor** button. The
button opens the full canvas editor; saving writes the new expression back through
`onChange`. The jq WASM runtime loads lazily and the evaluation worker installs
itself on mount — nothing else to wire.

See [`docs/quickstart.md`](docs/quickstart.md) and the runnable consumer example
under [`e2e/`](e2e/) (it is also the browser test harness).

## Public surface

- **Drop-in** — `JqField` (`JqFieldProps`).
- **Editor** — `JqEditorDialog` (alias of `JQEditorDialog`) + `JQEditorDialogProps`,
  `JQEditorProvider`, `useJQEditorState`, `TransformerPreview`, `TransformerEditor`.
- **Primitives injection** — `PrimitivesProvider`, `usePrimitives`,
  `builtinPrimitives`, `Primitives`, and the nine prop types.
- **jq runtime** — `preloadJq`, `runJq`, `JqResult`, `setJqWorkerFactory`,
  `JqWorkerFactory`, `installDefaultJqWorker`.
- **Graph model + converters** — `JQNodeType`, `ValueType`, `JQNodeData`,
  `JQNode`, `JQEdge`, `TransformersProps`, `convertJQToFlow`, `convertFlowToJQ`.
- **Node vocabulary** — `JQ_KIND_REGISTRY`, `ALL_JQ_NODE_KINDS`,
  `legendJqKindRows`, `JqKindEntry`.
- **Field declaration** — `JqFieldDeclaration`, `JqInputShapeDescriptor`,
  `JqInputKey`, `SampleInputProvider`, `ServerValidateHook`,
  `ServerValidationResult`, `ExpressionLanguage`.
- **Guard** — `roundTripVerdict`, `RoundTripVerdict`, `clearRoundTripVerdictCache`,
  `canRepresentFaithfully`, `checkJqValidity`, `JqValidity`.

## Documentation

- [Quickstart](docs/quickstart.md) — `JqField` end to end.
- [Embedding guide](docs/embedding.md) — `JqEditorDialog`, shapes, server-validate,
  the graph converters and guard for deep integrations.
- [Theme contract](docs/theme-contract.md) — every `--jq-*` token, what it colors,
  and the light/dark defaults.
- [Primitives injection](docs/primitives.md) — `PrimitivesProvider` and the
  contract each injectable component must satisfy.
- [Worker & CSP deployment](docs/worker-csp.md) — serving the worker from your
  origin, `wasm-unsafe-eval`, and the main-thread fallback.
- [Contributing & development](CONTRIBUTING.md).

## Styling in one line

jq-studio's editor styles are scoped under a single `.jq-studio-root` class, and
its default theme publishes the `--jq-*` tokens. Import the stylesheet once:

```ts
import '@tai42/jq-studio/styles.css';
```

To adopt your app's palette, redefine any `--jq-*` token on `:root` or on a
`.jq-studio-root` element — see the [theme contract](docs/theme-contract.md). To
use your own components instead of the built-ins, wrap in `PrimitivesProvider` —
see [primitives injection](docs/primitives.md).

## Worker / CSP, in brief

jq-web runs synchronously, so a non-terminating expression would freeze the tab.
jq-studio evaluates jq inside a Web Worker it can terminate on a deadline. The
build emits that worker as a **real, same-origin ES module file** next to the
other chunks, and `jq.wasm` beside it — both resolved by relative URL. Serve
`dist/` from your own origin under a CSP that allows `'wasm-unsafe-eval'`; where no
worker can be constructed, jq-studio falls back to synchronous main-thread
evaluation. Full notes in [docs/worker-csp.md](docs/worker-csp.md).

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
