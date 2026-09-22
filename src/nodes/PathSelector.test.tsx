/**
 * @fileoverview The path root menu offers the host's declared variables in their
 * own "Variables" group: each is a valid root of a path just like `.`. The group
 * appears only when variables are declared, and choosing one roots the path at
 * that variable.
 *
 * The heavy `Select` primitive is replaced with a light stand-in that renders its
 * groups and options as plain DOM and forwards a chosen value, so the test
 * exercises the root-menu PathSelector builds without driving the portalled Radix
 * listbox. The graph hooks are stubbed to an empty flow so the roots under test
 * come only from the declaration, not from preceding nodes.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AnySelectProps } from '../primitives/types';

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useNodes: () => [],
  useEdges: () => [],
}));

vi.mock('../primitives', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../primitives')>()),
  Select: (props: AnySelectProps) => {
    const { onValueChange, 'aria-label': ariaLabel } = props;
    const groups =
      props.groups ?? (props.options ? [{ label: 'Path root', options: props.options }] : []);
    return (
      <div role="listbox" aria-label={ariaLabel}>
        {groups.map((group) => (
          <div key={group.label} aria-label={group.label}>
            <span>{group.label}</span>
            {group.options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onValueChange?.(option.value);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

import { TransformerProvider } from '../TransformerContext';
import type { PathSegment } from '../types';
import { PathSelector } from './PathSelector';

const rootSegment = (): PathSegment => ({ id: 'seg_root', type: 'root', value: '.' });

const renderSelector = (
  declaredVariables: readonly string[],
  onSegmentsChange: (segments: PathSegment[]) => void = () => undefined,
) =>
  render(
    <TransformerProvider declaredVariables={declaredVariables}>
      <PathSelector
        nodeId="node-1"
        segments={[rootSegment()]}
        onSegmentsChange={onSegmentsChange}
      />
    </TransformerProvider>,
  );

const rootMenu = () => screen.getByRole('listbox', { name: 'Path root' });

describe('PathSelector declared-variable roots', () => {
  it('offers each declared variable under a Variables group', () => {
    renderSelector(['account']);

    const variables = within(rootMenu()).getByLabelText('Variables');
    expect(within(variables).getByRole('option', { name: '$account' })).toBeInTheDocument();
  });

  it('omits the Variables group when nothing is declared', () => {
    renderSelector([]);

    expect(within(rootMenu()).queryByLabelText('Variables')).not.toBeInTheDocument();
    expect(within(rootMenu()).queryByRole('option', { name: '$account' })).not.toBeInTheDocument();
    // The plain root is still offered.
    expect(within(rootMenu()).getByRole('option', { name: '.' })).toBeInTheDocument();
  });

  it('roots the path at the chosen variable', () => {
    const onSegmentsChange = vi.fn();
    renderSelector(['account'], onSegmentsChange);

    fireEvent.click(within(rootMenu()).getByRole('option', { name: '$account' }));

    expect(onSegmentsChange).toHaveBeenCalledTimes(1);
    const [segments] = onSegmentsChange.mock.calls[0] as [PathSegment[]];
    expect(segments[0]).toMatchObject({ type: 'node_ref', value: 'account' });
  });
});
