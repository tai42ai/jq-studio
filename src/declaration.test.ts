import { describe, it, expect } from 'vitest';
import type {
  JqFieldDeclaration,
  JqInputShapeDescriptor,
  ServerValidationResult,
} from './declaration';

/**
 * The declaration surface is types-only, so this test builds a real declaration
 * the way a host would and exercises its function-valued members — proving the
 * shape is descriptor-based (an arbitrary envelope, not an enum jq-studio knows)
 * and that the sample-input provider and server-validate hook are callable.
 */
describe('agnostic field declaration', () => {
  const shape: JqInputShapeDescriptor = {
    id: 'host:env',
    label: 'node envelope',
    blurb: 'The data a flow node receives when it runs.',
    keys: [
      { name: 'result', gloss: 'this node has no result yet — null' },
      { name: 'prior_outputs', gloss: 'outputs of the nodes that ran before' },
    ],
    returns: 'an object',
    caveats: ['.iterate is the enclosing loop, not this one'],
  };

  it('accepts an arbitrary, host-namespaced input shape descriptor', () => {
    expect(shape.id).toBe('host:env');
    expect(shape.keys.map((k) => k.name)).toContain('prior_outputs');
    expect(shape.caveats).toHaveLength(1);
  });

  it('carries a callable sample-input provider and server-validate hook', async () => {
    const validation: ServerValidationResult = { ok: true, compiles: true, singleEmit: true };
    const declaration: JqFieldDeclaration = {
      language: 'jq',
      shape,
      sampleInput: () => ({ result: null, prior_outputs: {} }),
      serverValidate: ({ expression }) =>
        Promise.resolve(expression.trim() ? validation : { ok: false, message: 'empty' }),
    };

    expect(declaration.language).toBe('jq');
    expect(declaration.sampleInput?.()).toEqual({ result: null, prior_outputs: {} });
    await expect(
      declaration.serverValidate?.({ expression: '.result', sampleInput: {} }),
    ).resolves.toEqual(validation);
    await expect(
      declaration.serverValidate?.({ expression: '  ', sampleInput: {} }),
    ).resolves.toEqual({ ok: false, message: 'empty' });
  });
});
