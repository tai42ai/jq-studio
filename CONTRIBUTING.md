# Contributing

Thanks for your interest in `@tai42/jq-studio`. This is an Apache-2.0 open-source
package; contributions are welcome.

## Development setup

Requires **Node ≥ 22** and **pnpm 11** (via corepack).

```bash
corepack enable
pnpm install
```

The first install approves the `esbuild` build script (pinned in
`pnpm-workspace.yaml`) that Vite and Vitest need.

## The gates

Everything CI runs, you can run locally:

```bash
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint (incl. the design-system independence ban)
pnpm format:check  # prettier
pnpm test          # vitest — the full suite (~900+ tests), incl. the 240-expression jq corpus
pnpm build         # the ESM library build + its emit assertions
```

`pnpm test:coverage` runs the suite with v8 coverage thresholds.

### End-to-end (real browser)

The [`e2e/`](e2e/) directory is a standalone Vite consumer app plus a Playwright
suite that drives the **built** artifact through the real WASM runtime. It doubles
as the repo's living example.

```bash
pnpm build                                   # produce dist/ (the e2e app imports it)
cd e2e
pnpm install
pnpm exec playwright install --with-deps chromium
pnpm test                                    # or: pnpm dev, to open the example
```

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `chore:`, …). release-please reads them to raise the
  version PR; the header subject starts lowercase and stays ≤ 100 chars.
- **Formatting** is Prettier (config in `.prettierrc`); **linting** is ESLint
  (flat config). Run both before pushing.
- **Design-system independence.** jq-studio depends on no design system. Render UI
  through `src/primitives` (a host substitutes components via `PrimitivesProvider`);
  never import `@tai42/studio-sdk` or any other component library. ESLint enforces
  this, and the build asserts no such string survives into `dist`.
- **Client-agnostic.** Nothing consumer- or product-specific may land — neutral
  names only, in code, fixtures, and the jq corpus.
- **The jq corpus** (`src/utils/converters/corpus/`) is the headline guarantee:
  every expression must round-trip faithfully or be honestly refused, never corrupt.
  If you change the converters, regenerate the frozen verdict table:

  ```bash
  GEN_CORPUS_VERDICTS=1 pnpm test
  ```

## Architecture, briefly

- `src/utils/converters/**` — the round-trip engine (jq ⇄ node graph) and the
  faithfulness oracle over the real jq WASM runtime.
- `src/utils/jq-*` — the WASM loader, the evaluation worker, and its main-thread
  client (terminate-on-deadline).
- `src/nodes/**`, `src/Transformer*`, `src/JQEditorDialog.tsx` — the canvas, node
  editors, and the editor dialog.
- `src/primitives/**` — the nine built-in UI primitives + the injection context.
- `src/JqField.tsx`, `src/declaration.ts`, `src/guard.ts`, `src/index.ts` — the
  drop-in, the field-declaration contract, the guard API, and the public surface.

## License

By contributing, you agree that your contributions are licensed under Apache-2.0.
