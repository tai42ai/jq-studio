// @vitest-environment node
/**
 * `checkJqValidity` proven against the real jq WASM runtime for declared
 * variables. An expression the visual editor cannot draw but which reads a
 * declared `$name` compiles as valid jq only when that name is declared; without
 * it, jq rejects the undefined `$name` as a compile error. A reserved declared
 * name is refused by the binder and surfaces as a rejection, never a silent
 * `valid`.
 *
 * The app's `jq-loader` resolves `jq.wasm` relative to the browser bundle, absent
 * in the node test host, so `jq-web` is routed at the package's on-disk wasm — the
 * REAL `checkJqValidity` (binding seam included) runs against the real runtime.
 */
import type { JqFactory } from 'jq-web';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('jq-web', async () => {
  const { createRequire } = await import('module');
  const { dirname, join } = await import('path');
  const require = createRequire(import.meta.url);
  const wasmPath = join(dirname(require.resolve('jq-web')), 'jq.wasm');
  const actual = await vi.importActual<{ default?: JqFactory; factory?: JqFactory }>('jq-web');
  const loaded = (actual.default ?? actual) as JqFactory & { factory?: JqFactory };
  const realFactory = loaded.factory ?? loaded;
  const factory: JqFactory = () => realFactory({ locateFile: () => wasmPath });
  return { factory, default: factory };
});

/** Valid jq that reads `$account` and uses `reduce`, a shape the visual converter
 *  cannot draw — so the preview leans on validity to tell it apart from broken jq. */
const UNDRAWABLE_WITH_VAR = '$account | reduce .[] as $x (0; . + $x)';

describe('checkJqValidity with declared variables (real jq runtime)', () => {
  let checkJqValidity: typeof import('./jq-loader').checkJqValidity;

  beforeEach(async () => {
    vi.resetModules();
    ({ checkJqValidity } = await import('./jq-loader'));
  });

  it('compiles a declared-variable expression as valid', async () => {
    await expect(checkJqValidity(UNDRAWABLE_WITH_VAR, ['account'])).resolves.toBe('valid');
  });

  it('reports the same expression invalid when the variable is not declared', async () => {
    await expect(checkJqValidity(UNDRAWABLE_WITH_VAR)).resolves.toBe('invalid');
  });

  it('propagates the binder’s refusal of a reserved declared name, never a silent valid', async () => {
    await expect(checkJqValidity('$account', ['__in'])).rejects.toThrow(/reserved/);
  });
});
