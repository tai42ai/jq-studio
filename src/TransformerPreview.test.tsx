/**
 * Tests for the Editor-tab thumbnail's fallback copy.
 *
 * The preview keys on TWO independent signals: whether the graph converter can
 * DRAW the expression (representability) and whether the jq itself COMPILES
 * (runtime validity). The runtime check is mocked so the split can be driven
 * deterministically; the representability signal is the real converter, fed a
 * valid-but-not-drawable expression and genuinely broken jq.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { checkJqValidityMock, roundTripVerdictMock } = vi.hoisted(() => ({
  checkJqValidityMock: vi.fn(),
  roundTripVerdictMock: vi.fn(),
}));
vi.mock('./utils/jq-loader', () => ({ checkJqValidity: checkJqValidityMock }));
vi.mock('./utils/converters/faithfulness-guard', () => ({
  roundTripVerdict: roundTripVerdictMock,
}));

import { TransformerPreview } from './TransformerPreview';

/**
 * A representative valid-but-not-drawable condition: it is jq that runs fine, but
 * bracket-indexing the `(… // {})` group as an operator operand is a shape the
 * visual converter has no faithful drawing for.
 */
const NOT_DRAWABLE_CONDITION =
  '((((((.states.record.todo // {})["identity"] // []) | map(select(.status == "open")) | map(. + {kind: "identity"}))) | length > 0) or (((.states.record.identity.subject_uuid // null) != null) | not))';

beforeEach(() => {
  checkJqValidityMock.mockReset();
  // Default: a parsed graph reads back faithfully, so the graph is drawn. Tests
  // that exercise the unfaithful fallback override this per-case.
  roundTripVerdictMock.mockReset();
  roundTripVerdictMock.mockResolvedValue('faithful');
});

describe('TransformerPreview fallback messaging', () => {
  it('shows a NEUTRAL notice (not an alert) for valid jq the editor cannot draw', async () => {
    checkJqValidityMock.mockResolvedValue('valid');
    render(<TransformerPreview expression={NOT_DRAWABLE_CONDITION} />);

    await waitFor(() => {
      expect(screen.getByText('Not shown here')).toBeInTheDocument();
    });

    // Neutral status region, never role=alert, and never the loud "Invalid" copy.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid expression')).not.toBeInTheDocument();
    expect(screen.getByText(/runs normally — edit it as text in Plain/i)).toBeInTheDocument();
    // The blocking construct is named from the converter's own message.
    expect(screen.getByText(/\["identity"\]/)).toBeInTheDocument();
    expect(checkJqValidityMock).toHaveBeenCalledWith(NOT_DRAWABLE_CONDITION);
  });

  it('keeps the LOUD alerting error for genuinely malformed jq', async () => {
    checkJqValidityMock.mockResolvedValue('invalid');
    render(
      <TransformerPreview
        expression="(("
        emptyHint="Open the visual editor to build this expression."
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Invalid expression')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('Not shown here')).not.toBeInTheDocument();
  });

  it('shows a quiet checking placeholder while validity is still resolving', async () => {
    // A pending promise: validity never resolves during this assertion.
    checkJqValidityMock.mockReturnValue(new Promise(() => undefined));
    render(<TransformerPreview expression={NOT_DRAWABLE_CONDITION} />);

    expect(await screen.findByText('Checking expression…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prompts to build when there is no expression yet, without checking validity', () => {
    render(
      <TransformerPreview
        expression=""
        emptyHint="Open the visual editor to build this expression."
      />,
    );
    expect(screen.getByText('No expression yet')).toBeInTheDocument();
    expect(
      screen.getByText('Open the visual editor to build this expression.'),
    ).toBeInTheDocument();
    expect(checkJqValidityMock).not.toHaveBeenCalled();
  });

  it('draws the graph (no validity check) once a representable expression reads back faithful', async () => {
    roundTripVerdictMock.mockResolvedValue('faithful');
    render(<TransformerPreview expression=".states.record.identity" />);

    // The graph is withheld behind the faithfulness check, then drawn: the
    // "Checking…" placeholder clears and no fallback copy is shown.
    await waitFor(() => {
      expect(screen.queryByText('Checking expression…')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Not shown here')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid expression')).not.toBeInTheDocument();
    expect(screen.queryByText('No expression yet')).not.toBeInTheDocument();
    // Faithfulness was consulted; runtime VALIDITY (the parse-fail path) was not.
    expect(roundTripVerdictMock).toHaveBeenCalledWith('.states.record.identity');
    expect(checkJqValidityMock).not.toHaveBeenCalled();
  });

  it('shows a NEUTRAL notice when the parsed graph does NOT read back faithfully', async () => {
    // A representable-looking expression whose graph the guard reports as a
    // different-behaving round-trip: it must be treated as unrepresentable.
    roundTripVerdictMock.mockResolvedValue('unfaithful');
    render(<TransformerPreview expression=".a.b.c" />);

    await waitFor(() => {
      expect(screen.getByText('Not shown here')).toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid expression')).not.toBeInTheDocument();
    expect(
      screen.getByText(/reading of this expression doesn't match it exactly/i),
    ).toBeInTheDocument();
    // The parse succeeded, so runtime validity is never consulted here.
    expect(checkJqValidityMock).not.toHaveBeenCalled();
  });

  it('withholds the graph behind a quiet placeholder while faithfulness is resolving', async () => {
    roundTripVerdictMock.mockReturnValue(new Promise(() => undefined));
    render(<TransformerPreview expression=".a.b.c" />);
    expect(await screen.findByText('Checking expression…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Not shown here')).not.toBeInTheDocument();
  });
});

describe('TransformerPreview unshownHint override', () => {
  const CUSTOM_HINT = 'Shown as text only — open the editor to view.';

  it('uses the built-in copy on the unrepresentable path when no override is given', async () => {
    checkJqValidityMock.mockResolvedValue('valid');
    render(<TransformerPreview expression={NOT_DRAWABLE_CONDITION} />);

    await waitFor(() => {
      expect(screen.getByText('Not shown here')).toBeInTheDocument();
    });
    expect(screen.getByText(/runs normally — edit it as text in Plain/i)).toBeInTheDocument();
    expect(screen.queryByText(CUSTOM_HINT)).not.toBeInTheDocument();
  });

  it('substitutes the override on the unrepresentable path when provided', async () => {
    checkJqValidityMock.mockResolvedValue('valid');
    render(<TransformerPreview expression={NOT_DRAWABLE_CONDITION} unshownHint={CUSTOM_HINT} />);

    await waitFor(() => {
      expect(screen.getByText('Not shown here')).toBeInTheDocument();
    });
    expect(screen.getByText(CUSTOM_HINT)).toBeInTheDocument();
    expect(screen.queryByText(/runs normally — edit it as text in Plain/i)).not.toBeInTheDocument();
    // Still a neutral status, never an alert.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses the built-in copy on the unfaithful path when no override is given', async () => {
    roundTripVerdictMock.mockResolvedValue('unfaithful');
    render(<TransformerPreview expression=".a.b.c" />);

    await waitFor(() => {
      expect(screen.getByText('Not shown here')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/reading of this expression doesn't match it exactly/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(CUSTOM_HINT)).not.toBeInTheDocument();
  });

  it('substitutes the override on the unfaithful path when provided', async () => {
    roundTripVerdictMock.mockResolvedValue('unfaithful');
    render(<TransformerPreview expression=".a.b.c" unshownHint={CUSTOM_HINT} />);

    await waitFor(() => {
      expect(screen.getByText('Not shown here')).toBeInTheDocument();
    });
    expect(screen.getByText(CUSTOM_HINT)).toBeInTheDocument();
    expect(
      screen.queryByText(/reading of this expression doesn't match it exactly/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
