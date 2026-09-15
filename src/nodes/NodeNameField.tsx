import type { Node } from '@xyflow/react';
import { useNodes, useReactFlow } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { Checkbox, TextInput } from '../primitives';
import { useSnapshot } from '../SnapshotContext';
import { useTransformerReadOnly } from '../TransformerContext';
import type { JQNodeData } from '../types';
import { InfoTooltip, NodeLabel } from '../ui';
import { nameVerdict } from '../utils/name-validation';

interface NodeNameFieldProps {
  id: string;
  name?: string;
  pipeAfterDeclare?: boolean;
  reservedNames?: string[];
  required?: boolean;
  label?: string;
  tooltip?: string;
  placeholder?: string;
}

const errorInputStyle: CSSProperties = { borderColor: 'var(--jq-color-danger)' };

/** The single error line for a name, keyed off its verdict flags (required-empty
 *  first, then invalid, reserved, non-unique), or null when the name is fine. */
const nameErrorMessage = (
  verdict: ReturnType<typeof nameVerdict>,
  required: boolean,
): string | null => {
  if (verdict.empty) return required ? 'Name is required' : null;
  if (!verdict.valid) {
    return 'Name must be a valid variable name (start with letter or underscore, followed by letters, numbers, or underscores)';
  }
  if (verdict.reserved) return 'Name conflicts with a built-in function';
  if (!verdict.unique) return 'Name must be unique';
  return null;
};

export const NodeNameField = memo(
  ({
    id,
    name = '',
    pipeAfterDeclare,
    reservedNames = [],
    required = false,
    label,
    tooltip,
    placeholder,
  }: NodeNameFieldProps) => {
    const { setNodes } = useReactFlow<Node<JQNodeData>>();
    const allNodes = useNodes<Node<JQNodeData>>();
    const readOnly = useTransformerReadOnly();
    const takeSnapshot = useSnapshot();

    const siblingNames = useMemo(
      () => allNodes.filter((node) => node.id !== id).map((node) => node.data.name ?? ''),
      [allNodes, id],
    );

    const verdict = useMemo(
      () => nameVerdict(name, siblingNames, reservedNames),
      [name, siblingNames, reservedNames],
    );
    const errorMessage = nameErrorMessage(verdict, required);

    const updateName = useCallback(
      (value: string) => {
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id ? { ...node, data: { ...node.data, name: value || undefined } } : node,
          ),
        );
      },
      [id, setNodes],
    );

    const updatePipeAfterDeclare = useCallback(
      (checked: boolean) => {
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, pipeAfterDeclare: checked || undefined } }
              : node,
          ),
        );
      },
      [id, setNodes],
    );

    const displayLabel = label ?? (required ? 'Name' : 'Name (optional)');
    const displayTooltip =
      tooltip ??
      'When set, the output is stored as $name and available to downstream nodes in the flow.';
    const displayPlaceholder = placeholder ?? 'variable_name';

    return (
      <div className="jqs-jq-field">
        <div className="jqs-jq-field__label-row">
          <NodeLabel>{displayLabel}</NodeLabel>
          <InfoTooltip text={displayTooltip} />
        </div>
        <TextInput
          value={name}
          onChange={(e) => {
            updateName(e.target.value.trim());
          }}
          // Snapshot the pre-edit state once as the field gains focus (the
          // established free-text idiom — see CommentNode), so a rename is
          // undoable even though a plain node click does not snapshot.
          onFocus={() => {
            takeSnapshot();
          }}
          readOnly={readOnly}
          placeholder={displayPlaceholder}
          style={errorMessage ? errorInputStyle : undefined}
        />
        {errorMessage && <p className="jqs-jq-field__error">{errorMessage}</p>}
        {!verdict.empty && pipeAfterDeclare !== undefined && (
          <div className="jqs-jq-field__checkbox-row">
            <Checkbox
              checked={pipeAfterDeclare}
              onCheckedChange={updatePipeAfterDeclare}
              disabled={readOnly}
              label={`Pipe $${name}`}
            />
          </div>
        )}
      </div>
    );
  },
);

NodeNameField.displayName = 'NodeNameField';
