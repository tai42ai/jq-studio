/**
 * The primitives surface jq-studio's editor renders through. Each export is a thin
 * WRAPPER that resolves the concrete component from {@link usePrimitives} at render
 * time, so a host's {@link PrimitivesProvider} overrides reach every call site
 * without prop drilling. The built-ins (`./builtin`) are the default behind the
 * context, so the wrappers work with no provider at all.
 */
import { usePrimitives } from './context';
import type {
  AnyButtonProps,
  AnySelectProps,
  BadgeProps,
  CheckboxProps,
  ConfirmDialogProps,
  DialogProps,
  TextInputProps,
  TextareaProps,
  TooltipProps,
} from './types';

export function Button(props: AnyButtonProps) {
  const P = usePrimitives();
  return <P.Button {...props} />;
}

export function TextInput(props: TextInputProps) {
  const P = usePrimitives();
  return <P.TextInput {...props} />;
}

export function Textarea(props: TextareaProps) {
  const P = usePrimitives();
  return <P.Textarea {...props} />;
}

export function Select(props: AnySelectProps) {
  const P = usePrimitives();
  return <P.Select {...props} />;
}

export function Checkbox(props: CheckboxProps) {
  const P = usePrimitives();
  return <P.Checkbox {...props} />;
}

export function Tooltip(props: TooltipProps) {
  const P = usePrimitives();
  return <P.Tooltip {...props} />;
}

export function Dialog(props: DialogProps) {
  const P = usePrimitives();
  return <P.Dialog {...props} />;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const P = usePrimitives();
  return <P.ConfirmDialog {...props} />;
}

export function Badge(props: BadgeProps) {
  const P = usePrimitives();
  return <P.Badge {...props} />;
}

export { PrimitivesProvider, usePrimitives } from './context';
export type { PrimitivesProviderProps } from './context';
export { builtinPrimitives } from './builtin';
export type {
  Primitives,
  ButtonProps,
  ButtonVariant,
  LinkButtonProps,
  AnyButtonProps,
  TextInputProps,
  TextareaProps,
  SelectProps,
  SelectGroupsProps,
  AnySelectProps,
  SelectOption,
  SelectGroup,
  CheckboxProps,
  TooltipProps,
  DialogProps,
  ConfirmDialogProps,
  BadgeProps,
} from './types';
