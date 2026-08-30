/**
 * @fileoverview WP-A5 / WP-B slot — the Test panel's shape-aware surfaces: the
 * JSON input seeded from the field's sample skeleton, the shape label, the
 * "must return" line, and the pluggable ServerValidateHook result the panel
 * surfaces when a host provides one. The jq WASM runner is stubbed so these tests
 * exercise only the panel UI.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./hooks/useJqRunner', () => ({
  useJqRunner: () => ({
    result: null,
    isRunning: false,
    run: vi.fn(),
    clear: vi.fn(),
    preload: vi.fn(),
  }),
}));

import { JqTestPanel } from './JqTestPanel';

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
      expect(input.value).toContain('"a": 1');
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
    });
    expect(screen.getByText('Compiles and emits one value.')).toBeInTheDocument();
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
