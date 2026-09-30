/**
 * What a spec needs from the stack it drives — the smallest honest form for this suite.
 *
 * Every test here drives the suite's OWN fixture page (`e2e/index.html`, which imports the
 * built `dist`) through the real wasm worker. No external stack serves that page, so every
 * spec declares `needs('fixture-page')` and a target only ever skips them. `TAI_E2E_TARGET`
 * set means "drive a running stack, build nothing": there is nothing here a running stack
 * could serve, so with it set every test is skipped with its unmet need as the reason
 * (visible in the JUnit report). Unset, the suite boots its own Vite server and runs as
 * always.
 *
 * The vocabulary matches the platform's, decided by the word before the first `:`:
 * reported (`kind:<kind>[:<name>]`), declared (`probe-tools`, `mutable`), and built
 * (`process`, `store`, `files`, `helper`, `setting`, `topology`, `cli`, `metrics`,
 * `second-stack`, `fixture-page`, `no-stack`) — the last only a stack the run builds itself
 * has, so such a test never runs against a target. A qualifier after `:` is free text for
 * the reader. This suite declares only `fixture-page`; the other classes are validated but
 * unused (there is no target file and no kinds fetch to check them against).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { test as base } from '@playwright/test';

/** Facts a target may declare it provides. */
const DECLARED_NEEDS: Readonly<Record<string, string>> = {
  'probe-tools': 'the e2e probe tools are loaded in the stack',
  mutable: 'tests may change stack-wide state',
};

/** Needs only a stack the run builds itself can meet. */
const BUILT_NEEDS: Readonly<Record<string, string>> = {
  process: "control of the stack's processes",
  store: "direct access to the stack's Redis or Postgres",
  files: "the stack's files on disk",
  helper: 'a local helper service the test controls',
  setting: 'a specific setting of the stack',
  topology: 'a specific process topology',
  cli: 'the CLI run beside the stack',
  metrics: 'the standalone metrics process',
  'second-stack': 'a second stack',
  'fixture-page': "the suite's own fixture page",
  'no-stack': 'no running stack at all',
};

/** Whether the run drives a running stack (`TAI_E2E_TARGET` set) instead of building one. */
const TARGET = !!process.env.TAI_E2E_TARGET?.trim();

function checkNeeds(list: readonly string[]): void {
  const unknown = list.filter((need) => {
    const [head, ...rest] = need.split(':');
    if (head === 'kind') return rest.join(':') === '';
    return !(need in DECLARED_NEEDS) && !(head in BUILT_NEEDS);
  });
  if (unknown.length > 0) {
    throw new Error(
      `unknown need(s) ${unknown.join(', ')}; a need is kind:<kind>[:<name>], one of ${Object.keys(DECLARED_NEEDS).join(', ')}, or one of ${Object.keys(BUILT_NEEDS).join(', ')} (optionally :<detail>)`,
    );
  }
}

/** Why a test with these needs cannot run against a target, or `undefined` when it can. */
function unmet(list: readonly string[] | undefined): string | undefined {
  if (list === undefined) return 'no needs declared: built-stack only';
  for (const need of list) {
    const [head] = need.split(':');
    if (head in BUILT_NEEDS) {
      return `needs ${need} (${BUILT_NEEDS[head]}): only a stack this run builds has it`;
    }
    if (need in DECLARED_NEEDS) {
      // A bare target (no target file) declares no provides, so a declared fact is unmet.
      return `target does not provide ${need} (${DECLARED_NEEDS[need]})`;
    }
    // A reported need (kind:*) is matched against the target's `/api/system/kinds`, which
    // this suite does not fetch; no spec here declares one (every test needs fixture-page).
  }
  return undefined;
}

export const test = base.extend<{ needs: readonly string[] | undefined; needsGate: void }>({
  needs: [undefined, { option: true }],
  needsGate: [
    async ({ needs: declared }, use, testInfo) => {
      if (declared !== undefined) {
        testInfo.annotations.push({ type: 'needs', description: declared.join(', ') || 'none' });
      }
      const reason = TARGET ? unmet(declared) : undefined;
      testInfo.skip(reason !== undefined, reason);
      await use();
    },
    { auto: true },
  ],
});

/** Declare what the tests of the enclosing file or `describe` need from the stack. */
export function needs(...list: string[]): void {
  checkNeeds(list);
  test.use({ needs: list });
  const reason = TARGET ? unmet(list) : undefined;
  test.skip(reason !== undefined, reason ?? '');
}

/**
 * The spec files that declare no needs. They are built-stack only, so a run against a
 * target leaves them out.
 */
export function undeclaredSpecs(): string[] {
  const dir = fileURLToPath(new URL('./tests/', import.meta.url));
  return readdirSync(dir)
    .filter((name) => name.endsWith('.spec.ts'))
    .filter((name) => !/^\s*needs\(/m.test(readFileSync(`${dir}${name}`, 'utf8')))
    .map((name) => `**/${name}`);
}
