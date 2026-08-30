/**
 * Tests for {@link checkJqValidity}: the compile-validity signal that the Editor
 * tab keys on, apart from whether the visual editor can DRAW an expression.
 *
 * The WASM runtime is mocked so each jq outcome — a clean compile, a compile
 * error, a runtime error, a runtime that will not load — is exercised
 * deterministically, without shipping the real binary through jsdom.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { jsonMock, factoryMock } = vi.hoisted(() => ({
  jsonMock: vi.fn(),
  factoryMock: vi.fn(),
}));

vi.mock('jq-web', () => ({ factory: factoryMock, default: factoryMock }));

beforeEach(() => {
  vi.resetModules();
  jsonMock.mockReset();
  factoryMock.mockReset();
  factoryMock.mockResolvedValue({ json: jsonMock, raw: vi.fn() });
});

async function freshCheck(): Promise<(e: string) => Promise<'valid' | 'invalid'>> {
  const mod = await import('./jq-loader');
  return mod.checkJqValidity;
}

describe('checkJqValidity', () => {
  it('treats an empty expression as valid without touching the runtime', async () => {
    const check = await freshCheck();
    await expect(check('   ')).resolves.toBe('valid');
    expect(factoryMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it('reports a clean compile as valid', async () => {
    jsonMock.mockReturnValue(true);
    const check = await freshCheck();
    await expect(check('.a == 1')).resolves.toBe('valid');
  });

  it('reports a compile error as invalid', async () => {
    jsonMock.mockImplementation(() => {
      throw new Error(
        'Non-zero exit code: 3\njq: error: syntax error, unexpected end of file at <top-level>, line 1:\n.foo |\njq: 1 compile error',
      );
    });
    const check = await freshCheck();
    await expect(check('.foo |')).resolves.toBe('invalid');
  });

  it('reports a RUNTIME error as valid — the program compiled, it just failed on the input', async () => {
    jsonMock.mockImplementation(() => {
      throw new Error(
        'Non-zero exit code: 5\njq: error (at inputString:0): Cannot iterate over null (null)',
      );
    });
    const check = await freshCheck();
    await expect(check('map(.+1)')).resolves.toBe('valid');
  });

  it('does not cry wolf when the runtime cannot load — validity is unproven, not disproven', async () => {
    factoryMock.mockRejectedValueOnce(new Error('wasm failed to instantiate'));
    const check = await freshCheck();
    await expect(check('.anything')).resolves.toBe('valid');
  });
});

async function freshRunJq(): Promise<
  (expression: string, jsonInput: string) => Promise<import('./jq-loader').JqResult>
> {
  const mod = await import('./jq-loader');
  return mod.runJq;
}

describe('runJq', () => {
  it('returns the program output on a clean run', async () => {
    jsonMock.mockReturnValue({ ok: true });
    const runJq = await freshRunJq();
    const res = await runJq('.', '{"ok":true}');
    expect(res.success).toBe(true);
    expect(res.output).toContain('"ok": true');
  });

  it('rejects invalid JSON input before touching the engine', async () => {
    const runJq = await freshRunJq();
    const res = await runJq('.', 'not json');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid JSON input');
    expect(factoryMock).not.toHaveBeenCalled();
  });

  it('surfaces a FRIENDLY message when the WASM engine cannot load (not the raw loader error)', async () => {
    factoryMock.mockRejectedValueOnce(new Error('RuntimeError: abort(TypeError) at jsStackTrace'));
    const runJq = await freshRunJq();
    const res = await runJq('.', '{}');
    expect(res.success).toBe(false);
    expect(res.error).toBe(
      'The jq engine could not load. Check your connection and reopen the editor to try again.',
    );
    // The raw emscripten error is NOT leaked to the user.
    expect(res.error).not.toContain('RuntimeError');
  });

  it('shows a jq evaluation error VERBATIM (the user’s own program, not a load failure)', async () => {
    jsonMock.mockImplementation(() => {
      throw new Error('jq: error (at <stdin>:0): Cannot index number with "a"');
    });
    const runJq = await freshRunJq();
    const res = await runJq('.a', '5');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Cannot index number');
  });
});
