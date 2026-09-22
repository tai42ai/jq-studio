/**
 * @fileoverview The Test panel's shape-aware surfaces: the
 * JSON input seeded from the field's sample skeleton, the shape label, the
 * "must return" line, and the pluggable ServerValidateHook result the panel
 * surfaces when a host provides one. The jq WASM runner is stubbed so these tests
 * exercise only the panel UI.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stable runner spies so a test can assert whether a run was invoked; the UI
// surfaces (result, isRunning) stay inert so these tests exercise only the panel.
const runnerMock = vi.hoisted(() => ({
  run: vi.fn(),
  fail: vi.fn(),
  clear: vi.fn(),
  preload: vi.fn(),
}));

vi.mock('./hooks/useJqRunner', () => ({
  useJqRunner: () => ({
    result: null,
    isRunning: false,
    ...runnerMock,
  }),
}));

import { JqTestPanel } from './JqTestPanel';

beforeEach(() => {
  runnerMock.run.mockClear();
  runnerMock.fail.mockClear();
  runnerMock.clear.mockClear();
  runnerMock.preload.mockClear();
});

const openPanel = () => {
  fireEvent.click(screen.getByRole('button', { name: /Test/ }));
};

describe('JqTestPanel shape + server-validate surfaces', () => {
  it('seeds the JSON input with the shape sample and names the shape', async () => {
    render(
      <JqTestPanel
        expression=".a"
        validationErrors={new Map()}
        sampleInput={'{\n  "a": 1\n}'}
        shapeLabel="node envelope"
        returns="an object"
      />,
    );
    openPanel();

    const input = await screen.findByRole<HTMLTextAreaElement>('textbox');
    await waitFor(() => {
      expect(input.value).toContain('"a"');
    });
    expect(screen.getByText('as: node envelope')).toBeInTheDocument();
  });

  it('surfaces the server-validate result when a host provides the hook', async () => {
    const serverValidate = vi
      .fn()
      .mockResolvedValue({ ok: true, message: 'Compiles and emits one value.' });
    render(
      <JqTestPanel
        expression=".a"
        validationErrors={new Map()}
        sampleInput={'{"a":1}'}
        serverValidate={serverValidate}
      />,
    );
    openPanel();

    const validateBtn = await screen.findByRole('button', { name: /Validate/ });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(screen.getByText('Valid on server')).toBeInTheDocument();
    });
    expect(serverValidate).toHaveBeenCalledWith({
      expression: '.a',
      sampleInput: { a: 1 },
      sampleVariables: {},
    });
    expect(screen.getByText('Compiles and emits one value.')).toBeInTheDocument();
  });

  it('passes the declared variable samples to the server-validate hook', async () => {
    const serverValidate = vi.fn().mockResolvedValue({ ok: true });
    render(
      <JqTestPanel
        expression="$account.tier"
        validationErrors={new Map()}
        sampleInput={'{"a":1}'}
        sampleVariables={{ account: { tier: 'gold' } }}
        serverValidate={serverValidate}
      />,
    );
    openPanel();

    const validateBtn = await screen.findByRole('button', { name: /Validate/ });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(serverValidate).toHaveBeenCalledWith({
        expression: '$account.tier',
        sampleInput: { a: 1 },
        sampleVariables: { account: { tier: 'gold' } },
      });
    });
  });

  it('lists each declared variable with its blurb and the bound sample', async () => {
    render(
      <JqTestPanel
        expression="$account.tier"
        validationErrors={new Map()}
        sampleInput={'{"id":"r-1"}'}
        variables={[{ name: 'account', blurb: 'The account this run belongs to.' }]}
        sampleVariables={{ account: { tier: 'gold' } }}
      />,
    );
    openPanel();

    await screen.findByRole('textbox');
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('Bound on Run from the field’s declaration.')).toBeInTheDocument();
    expect(screen.getByText('$account')).toBeInTheDocument();
    expect(screen.getByText('The account this run belongs to.')).toBeInTheDocument();
    // The bound sample the run will use is shown, read-only.
    expect(screen.getByText(/"tier": "gold"/)).toBeInTheDocument();
  });

  it('omits the Variables section when the field declares none', async () => {
    render(<JqTestPanel expression=".a" validationErrors={new Map()} />);
    openPanel();

    await screen.findByRole('textbox');
    expect(screen.queryByText('Variables')).not.toBeInTheDocument();
  });

  it('hangs the library scoping class on the portaled dialog content so scoped styles apply', async () => {
    render(<JqTestPanel expression=".a" validationErrors={new Map()} />);
    openPanel();

    // The primitives Dialog portals to document.body; the scoping class must ride on the
    // content element or every `jqs-jq-*` rule (spread label rows, muted shape
    // annotation, kbd chip) is dropped and the labels collapse to run-on text.
    const dialog = await screen.findByRole('dialog', { name: 'Test Expression' });
    expect(dialog).toHaveClass('jq-studio-root');
  });

  it('omits the Validate action when no server hook is wired', async () => {
    render(<JqTestPanel expression=".a" validationErrors={new Map()} />);
    openPanel();

    await screen.findByRole('textbox');
    expect(screen.queryByRole('button', { name: /Validate/ })).not.toBeInTheDocument();
  });
});

/** A sample-provider failure blocks the run even when the input is non-empty: the
 *  Run button stays disabled and the keyboard run guard surfaces the error
 *  instead of running over a silent fallback. */
describe('JqTestPanel run guard on a sample failure', () => {
  it('keeps Run disabled and never runs with non-empty input when the sample failed', async () => {
    render(
      <JqTestPanel
        expression=".a"
        validationErrors={new Map()}
        sampleInput={'{"a":1}'}
        sampleError="variables exploded"
      />,
    );
    openPanel();

    const input = await screen.findByRole<HTMLTextAreaElement>('textbox');
    await waitFor(() => {
      expect(input.value).toContain('"a"');
    });
    const runBtn = screen.getByRole('button', { name: /Run/ });
    expect(runBtn).toBeDisabled();
    fireEvent.click(runBtn);
    expect(runnerMock.run).not.toHaveBeenCalled();
  });

  it('surfaces the sample error on Ctrl+Enter instead of running', async () => {
    render(
      <JqTestPanel
        expression=".a"
        validationErrors={new Map()}
        sampleInput={'{"a":1}'}
        sampleError="variables exploded"
      />,
    );
    openPanel();

    const input = await screen.findByRole<HTMLTextAreaElement>('textbox');
    await waitFor(() => {
      expect(input.value).toContain('"a"');
    });
    runnerMock.fail.mockClear();

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    expect(runnerMock.run).not.toHaveBeenCalled();
    expect(runnerMock.fail).toHaveBeenCalledWith('variables exploded');
  });
});
