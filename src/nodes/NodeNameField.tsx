import { memo, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { Checkbox, TextInput } from '../primitives';
import type { JQNodeData } from '../types';
import { VALID_NAME_PATTERN } from '../enums';
import { useTransformerReadOnly } from '../TransformerContext';
import { useSnapshot } from '../SnapshotContext';
import { InfoTooltip, NodeLabel } from '../ui';

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

    const hasName = name.length > 0;

    const isValidVariableName = useMemo(
      () => !hasName || VALID_NAME_PATTERN.test(name),
      [name, hasName],
    );

    const isNotReserved = useMemo(
      () => !hasName || !reservedNames.includes(name),
      [name, hasName, reservedNames],
    );

    const isUnique = useMemo(() => {
      if (!hasName) return true;
      return !allNodes.some((node) => node.id !== id && node.data.name === name);
    }, [id, name, hasName, allNodes]);

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

    const hasError =
      (required && !hasName) || (hasName && (!isUnique || !isValidVariableName || !isNotReserved));

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
          // undoable now that a plain node click no longer snapshots.
          onFocus={() => {
            takeSnapshot();
          }}
          readOnly={readOnly}
          placeholder={displayPlaceholder}
          style={hasError ? errorInputStyle : undefined}
        />
        {required && !hasName && <p className="jqs-jq-field__error">Name is required</p>}
        {hasName && !isValidVariableName && (
          <p className="jqs-jq-field__error">
            Name must be a valid variable name (start with letter or underscore, followed by
            letters, numbers, or underscores)
          </p>
        )}
        {hasName && isValidVariableName && !isNotReserved && (
          <p className="jqs-jq-field__error">Name conflicts with a built-in function</p>
        )}
        {hasName && isValidVariableName && isNotReserved && !isUnique && (
          <p className="jqs-jq-field__error">Name must be unique</p>
        )}
        {hasName && pipeAfterDeclare !== undefined && (
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
