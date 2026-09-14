/**
 * Pure data for the Value node: the reset shape when switching value type, the
 * one-line collapsed summary, and the array-item / object-field list reducers —
 * kept apart from the node so the transforms are testable without a canvas.
 */
import { ValueType } from '../../enums';
import type { JQValueData, ValueArrayItem, ValueObjectField } from '../../types';

export const nextItemId = (): string => crypto.randomUUID();

/** The reset field values a Value node takes when switched to `vt`: every
 *  variant is cleared, then the one the new type owns is seeded. */
export const valueTypeBase = (vt: ValueType): Partial<JQValueData> => {
  const base: Partial<JQValueData> = {
    valueType: vt,
    value: undefined,
    items: undefined,
    fields: undefined,
    pathValue: undefined,
  };
  switch (vt) {
    case ValueType.String:
      return { ...base, value: '' };
    case ValueType.Number:
      return { ...base, value: 0 };
    case ValueType.Boolean:
      return { ...base, value: false };
    case ValueType.Array:
      return { ...base, items: [] };
    case ValueType.Object:
      return { ...base, fields: [] };
    case ValueType.Null:
      return { ...base, value: null };
    default:
      return base;
  }
};

/** The one-line summary shown on the collapsed card, per value type. */
export const getValueSummary = (data: JQValueData): string => {
  switch (data.valueType) {
    case ValueType.Array:
      return '[]';
    case ValueType.Object:
      return '{}';
    case ValueType.Path:
      return data.pathValue ?? '.';
    case ValueType.Null:
      return 'null';
    case ValueType.Boolean:
      return String(data.value ?? false);
    case ValueType.Number:
      return String(data.value ?? 0);
    case ValueType.String:
      return data.value !== undefined ? `"${String(data.value)}"` : '""';
    default:
      return '';
  }
};

export const addArrayItem = (items: ValueArrayItem[]): ValueArrayItem[] => [
  ...items,
  { id: nextItemId() },
];

export const removeArrayItem = (items: ValueArrayItem[], itemId: string): ValueArrayItem[] =>
  items.filter((i) => i.id !== itemId);

export const addObjectField = (fields: ValueObjectField[]): ValueObjectField[] => [
  ...fields,
  { id: nextItemId(), name: '' },
];

export const removeObjectField = (
  fields: ValueObjectField[],
  fieldId: string,
): ValueObjectField[] => fields.filter((f) => f.id !== fieldId);

export const setObjectFieldName = (
  fields: ValueObjectField[],
  fieldId: string,
  name: string,
): ValueObjectField[] => fields.map((f) => (f.id === fieldId ? { ...f, name } : f));
