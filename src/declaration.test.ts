import { describe, expect, it } from 'vitest';

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
    label: 'record envelope',
    blurb: 'The data one record carries.',
    keys: [
      { name: 'result', gloss: 'this record has no result yet — null' },
      { name: 'history', gloss: 'the values recorded before this one' },
    ],
    returns: 'an object',
    caveats: ['.index is the outer position, not this one'],
    variables: [
      {
        name: 'account',
        blurb: 'The account the expression reads.',
        keys: [{ name: 'tags', gloss: "the account's tags" }],
        sample: { tags: [] },
      },
    ],
  };

  it('accepts an arbitrary, host-namespaced input shape descriptor', () => {
    expect(shape.id).toBe('host:env');
    expect(shape.keys.map((k) => k.name)).toContain('history');
    expect(shape.caveats).toHaveLength(1);
  });

  it('describes the named variables the host binds beside `.`', () => {
    expect(shape.variables?.map((v) => v.name)).toEqual(['account']);
    expect(shape.variables?.[0]?.keys.map((k) => k.name)).toEqual(['tags']);
    expect(shape.variables?.[0]?.sample).toEqual({ tags: [] });
  });

  it('carries callable sample providers and a variable-aware server-validate hook', async () => {
    const validation: ServerValidationResult = { ok: true, compiles: true, singleEmit: true };
    const declaration: JqFieldDeclaration = {
      language: 'jq',
      shape,
      sampleInput: () => ({ result: null, history: {} }),
      sampleVariables: () => ({ account: { tags: ['a-1'] } }),
      serverValidate: ({ expression, sampleVariables }) =>
        Promise.resolve(
          expression.trim() && 'account' in sampleVariables
            ? validation
            : { ok: false, message: 'empty' },
        ),
    };

    expect(declaration.language).toBe('jq');
    expect(declaration.sampleInput?.()).toEqual({ result: null, history: {} });
    expect(declaration.sampleVariables?.()).toEqual({ account: { tags: ['a-1'] } });
    await expect(
      declaration.serverValidate?.({
        expression: '$account.tags',
        sampleInput: {},
        sampleVariables: { account: { tags: [] } },
      }),
    ).resolves.toEqual(validation);
    await expect(
      declaration.serverValidate?.({ expression: '  ', sampleInput: {}, sampleVariables: {} }),
    ).resolves.toEqual({ ok: false, message: 'empty' });
  });
});
