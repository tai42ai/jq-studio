/**
 * A deadline TIMEOUT must never read as agreement in the faithfulness oracle.
 *
 * Two programs that both ERROR on an input agree there (jq's error is the result).
 * But a timeout is the oracle giving up, not an observable jq behaviour, so it must
 * agree with NOTHING — not a value, not an error, not even another timeout — or the
 * runtime guard could call a graph "faithful" on the very inputs it could not check.
 */
import { describe, expect, it } from 'vitest';
import { compareJqSemantics } from './faithfulness';
import { JqTimeoutError } from '../jq-worker-client';

describe('faithfulness oracle — timeout is unfaithful-safe', () => {
  it('reports unfaithful when BOTH programs time out (a timeout never agrees)', async () => {
    const timeoutExec = () => Promise.reject(new JqTimeoutError());
    await expect(compareJqSemantics('a', 'b', timeoutExec, [null])).resolves.toBe('unfaithful');
  });

  it('reports unfaithful when one side times out and the other returns a value', async () => {
    const exec = (program: string) =>
      program.includes('a') ? Promise.reject(new JqTimeoutError()) : Promise.resolve([1]);
    await expect(compareJqSemantics('a', 'b', exec, [null])).resolves.toBe('unfaithful');
  });

  it('still reports faithful when both sides raise ordinary jq errors (not timeouts)', async () => {
    const errExec = () => Promise.reject(new Error('jq: Cannot iterate over null'));
    await expect(compareJqSemantics('a', 'b', errExec, [null])).resolves.toBe('faithful');
  });
});
