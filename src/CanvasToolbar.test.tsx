/**
 * A host sample provider that throws is a failure, not a "no sample" signal: the
 * Test panel shows the error the moment it opens (the same surface a jq error
 * uses) and its Run button stays disabled, so nothing runs over a silent
 * fallback. Covers both the `.` sample provider and the variables provider.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Opening the Test panel preloads the WASM runtime; jsdom cannot fetch it, so
// stub the preload to a no-op (the run itself is never reached in these tests).
vi.mock('./utils/jq-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils/jq-loader')>()),
  preloadJq: () => undefined,
}));

import { CanvasToolbar } from './CanvasToolbar';
import type { JqInputShapeDescriptor } from './declaration';

const baseProps = {
  problemCount: 0,
  problemNodeIds: [],
  focusNextProblem: () => undefined,
  onLoad: () => undefined,
  expression: '.a',
  validationErrors: new Map(),
};

const openTestPanel = () => {
  fireEvent.click(screen.getByRole('button', { name: /Test/ }));
};

describe('CanvasToolbar sample-provider failures', () => {
  it('surfaces a throwing `.` sample provider and blocks the run', async () => {
    render(
      <CanvasToolbar
        {...baseProps}
        sampleInput={() => {
          throw new Error('sample input exploded');
        }}
      />,
    );
    openTestPanel();

    await waitFor(() => {
      expect(screen.getByText('sample input exploded')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Run/ })).toBeDisabled();
  });

  it('surfaces a throwing variables provider and blocks the run', async () => {
    const shape: JqInputShapeDescriptor = {
      id: 'host:env',
      label: 'request',
      blurb: 'The data.',
      keys: [],
      returns: 'any value',
      variables: [{ name: 'account', blurb: 'The account.', keys: [] }],
    };
    render(
      <CanvasToolbar
        {...baseProps}
        shape={shape}
        sampleVariables={() => {
          throw new Error('variables exploded');
        }}
      />,
    );
    openTestPanel();

    await waitFor(() => {
      expect(screen.getByText('variables exploded')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Run/ })).toBeDisabled();
  });
});

/** A declared variable name is held to the binder's own rule at the resolver, so
 *  a reserved or malformed name surfaces as the panel's error (Run disabled)
 *  instead of throwing out of the Run click. */
describe('CanvasToolbar declared-name validation', () => {
  const shapeWithVariable = (name: string): JqInputShapeDescriptor => ({
    id: 'host:env',
    label: 'request',
    blurb: 'The data.',
    keys: [],
    returns: 'any value',
    variables: [{ name, blurb: 'A declared variable.', keys: [] }],
  });

  it('surfaces a reserved declared name and blocks the run', async () => {
    render(<CanvasToolbar {...baseProps} shape={shapeWithVariable('__in')} />);
    openTestPanel();

    await waitFor(() => {
      expect(screen.getByText(/reserved jq variable name/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Run/ })).toBeDisabled();
  });

  it('surfaces a non-identifier declared name and blocks the run', async () => {
    render(<CanvasToolbar {...baseProps} shape={shapeWithVariable('bad name')} />);
    openTestPanel();

    await waitFor(() => {
      expect(screen.getByText(/not a valid jq variable name/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Run/ })).toBeDisabled();
  });
});

/** The resolver builds a null-prototype map and reads provider entries by own-key
 *  only, so a declared name that collides with an object built-in binds its own
 *  value rather than hitting a prototype accessor or reading an inherited one. */
describe('CanvasToolbar prototype-safe variable resolution', () => {
  it('binds a declared `__proto__` variable as its own key from the static sample', async () => {
    const shape: JqInputShapeDescriptor = {
      id: 'host:env',
      label: 'request',
      blurb: 'The data.',
      keys: [],
      returns: 'any value',
      variables: [
        { name: '__proto__', blurb: 'A prototype-named variable.', keys: [], sample: 'gold' },
      ],
    };
    render(<CanvasToolbar {...baseProps} shape={shape} />);
    openTestPanel();

    await waitFor(() => {
      expect(screen.getByText('$__proto__')).toBeInTheDocument();
    });
    expect(screen.getByText('"gold"')).toBeInTheDocument();
  });

  it('resolves a declared `constructor` with no provider entry to null, never the inherited value', async () => {
    const shape: JqInputShapeDescriptor = {
      id: 'host:env',
      label: 'request',
      blurb: 'The data.',
      keys: [],
      returns: 'any value',
      variables: [{ name: 'constructor', blurb: 'A built-in-named variable.', keys: [] }],
    };
    render(<CanvasToolbar {...baseProps} shape={shape} sampleVariables={() => ({})} />);
    openTestPanel();

    await waitFor(() => {
      expect(screen.getByText('$constructor')).toBeInTheDocument();
    });
    expect(screen.getByText('null')).toBeInTheDocument();
  });
});

/** Each declared variable's bound sample follows provider → static sample → null,
 *  read by the panel's Variables section from the resolved map. */
describe('CanvasToolbar variable-sample precedence', () => {
  it('resolves each declared variable by provider, static sample, then null', async () => {
    const shape: JqInputShapeDescriptor = {
      id: 'host:env',
      label: 'request',
      blurb: 'The data.',
      keys: [],
      returns: 'any value',
      variables: [
        { name: 'account', blurb: 'From the provider.', keys: [], sample: { tier: 'bronze' } },
        { name: 'tier', blurb: 'Static sample only.', keys: [], sample: 'gold' },
        { name: 'alice', blurb: 'Neither provided nor sampled.', keys: [] },
      ],
    };
    render(
      <CanvasToolbar
        {...baseProps}
        shape={shape}
        sampleVariables={() => ({ account: { tier: 'platinum' } })}
      />,
    );
    openTestPanel();

    await waitFor(() => {
      expect(screen.getByText('$account')).toBeInTheDocument();
    });
    // Provider wins over the variable's own static sample.
    expect(screen.getByText(/"tier": "platinum"/)).toBeInTheDocument();
    expect(screen.queryByText(/"tier": "bronze"/)).not.toBeInTheDocument();
    // No provider entry falls back to the static sample.
    expect(screen.getByText('"gold"')).toBeInTheDocument();
    // Neither provided nor sampled resolves to null.
    expect(screen.getByText('null')).toBeInTheDocument();
  });
});
