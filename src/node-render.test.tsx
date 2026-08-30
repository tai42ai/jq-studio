/**
 * Read-only render smoke tests for the node vocabulary: each expression below
 * draws a graph whose collapsed cards exercise a distinct node component
 * (Condition, Try/Catch, Operator, Define/Call Function) through the shared
 * `TransformerPreview`. The faithfulness guard is mocked `faithful` so the graph
 * is actually drawn; this pins that the redesigned card chrome renders for every
 * kind without throwing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';

const { roundTripVerdictMock, checkJqValidityMock } = vi.hoisted(() => ({
  roundTripVerdictMock: vi.fn(),
  checkJqValidityMock: vi.fn(),
}));
vi.mock('./utils/converters/faithfulness-guard', () => ({
  roundTripVerdict: roundTripVerdictMock,
}));
vi.mock('./utils/jq-loader', () => ({ checkJqValidity: checkJqValidityMock }));

import { TransformerPreview } from './TransformerPreview';

beforeEach(() => {
  roundTripVerdictMock.mockReset();
  roundTripVerdictMock.mockResolvedValue('faithful');
  checkJqValidityMock.mockReset();
  checkJqValidityMock.mockResolvedValue('valid');
});

async function expectDrawn(expression: string): Promise<void> {
  render(<TransformerPreview expression={expression} />);
  // Once faithfulness resolves, the graph is drawn: the "Checking…" placeholder
  // clears and no fallback/alert copy is shown.
  await waitFor(() => {
    expect(screen.queryByText('Checking expression…')).not.toBeInTheDocument();
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText('Not shown here')).not.toBeInTheDocument();
}

describe('node vocabulary renders in a read-only preview', () => {
  it('draws a Condition (if / then / else) graph', async () => {
    await expectDrawn('if .a then .b else .c end');
  });

  it('draws a Try/Catch graph', async () => {
    await expectDrawn('try .a catch .b');
  });

  it('draws an Operator graph', async () => {
    await expectDrawn('.a + .b');
  });

  it('draws a Define + Call Function graph', async () => {
    await expectDrawn('def bump: . + 1; bump');
  });

  it('draws object / array / nested-path Value graphs', async () => {
    await expectDrawn('{name: .result.user.name, city: .result.user.address.city}');
    await expectDrawn('[.a, .b, .c]');
    await expectDrawn('.result.tags | length');
  });
});
