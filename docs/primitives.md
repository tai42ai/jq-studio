# Primitives injection

jq-studio renders its editor chrome out of exactly **nine small UI primitives**.
Each ships as a minimal, accessible, token-styled built-in, and each is looked up
through React context — so a host can substitute its own design-system components
without jq-studio depending on that design system.

## The built-ins

The default set (`builtinPrimitives`) is:

`Button`, `TextInput`, `Textarea`, `Select`, `Checkbox`, `Tooltip`, `Dialog`,
`ConfirmDialog`, `Badge`.

`Button`/`TextInput`/`Textarea`/`Badge` are plain token-styled HTML; `Select`,
`Checkbox`, `Tooltip`, and `Dialog` are built on the corresponding Radix
primitives (accessible focus trapping, portalling, and keyboard semantics);
`ConfirmDialog` composes `Dialog` + `Button`. They paint from the `--jq-*`
[theme tokens](theme-contract.md) and are deliberately not scoped under
`.jq-studio-root`, so portalled content styles correctly.

## Substituting your own

Wrap the editor (or the whole app) in `PrimitivesProvider`. Pass overrides for any
subset; anything you omit keeps the built-in.

```tsx
import { PrimitivesProvider, JqField } from '@tai42/jq-studio';
import type { AnyButtonProps } from '@tai42/jq-studio';
import { MyButton } from './design-system';

function HostButton(props: AnyButtonProps) {
  // Map jq-studio's prop shape onto your component.
  if (props.href !== undefined) return <a href={props.href}>{props.children}</a>;
  const { variant, ...rest } = props;
  return <MyButton kind={variant} {...rest} />;
}

export function App() {
  return (
    <PrimitivesProvider primitives={{ Button: HostButton }}>
      <JqField label="Transform" value={expr} onChange={setExpr} />
    </PrimitivesProvider>
  );
}
```

`PrimitivesProvider` merges your overrides over the built-ins (and over any
enclosing provider), so you can replace one control or all nine.

## The contract each injectable component must satisfy

Your component must accept the prop shape below (the minimal-but-sufficient surface
every call site inside jq-studio relies on) and render an accessible control. Extra
props you add are ignored by jq-studio.

### `Button` — `AnyButtonProps`

The action form is native `<button>` attributes plus `variant?: 'primary' |
'secondary' | 'ghost' | 'danger'`. The link form adds a required `href` (render an
anchor). Honour `onClick`, `disabled`, `type`, `title`, and `children`.

### `TextInput` — `TextInputProps` / `Textarea` — `TextareaProps`

Native `<input>` / `<textarea>` attributes (`value`, `onChange`, `readOnly`,
`placeholder`, `id`, …), forwarded to the element. Forward `ref` if you can.

### `Select` — `AnySelectProps`

Exactly one of `options` or `groups` (each `{ value, label, disabled? }` /
`{ label, options }`). Also `value`, `defaultValue`, `onValueChange(value)`,
`placeholder`, `disabled`, `name`, `aria-label`. Render an accessible listbox.

### `Checkbox` — `CheckboxProps`

`checked?: boolean | 'indeterminate'`, `defaultChecked`, `onCheckedChange(boolean)`,
`disabled`, `label?`, `aria-label?`, `name`, `value`. When `label` is set, render a
linked label; otherwise expose `aria-label`.

### `Tooltip` — `TooltipProps`

`content: ReactNode`, `children: ReactElement` (the trigger — a single element, not
a string), `delayDuration?`. Wire `content` to the trigger as a description.

### `Dialog` — `DialogProps`

`title` (required; names the dialog even when visually hidden), `description?`,
`children?`, `trigger?`, `open?`, `defaultOpen?`, `onOpenChange(open)`,
`fullscreen?`, `contentClassName?` (merged onto the content element — jq-studio
hangs `.jq-studio-root` here so its scoped styles reach inside a portal), and
`chromeless?` (drop the visible title + wrapper, still name the dialog). Provide a
focus trap, Escape-to-close, and scroll lock.

### `ConfirmDialog` — `ConfirmDialogProps`

`title`, `confirmLabel`, `pendingLabel`, `onConfirm()`, `onClose()`, `isPending`,
`error?`, `confirmVariant?: 'primary' | 'danger'`, `children`. Render the prompt
plus Cancel / confirm actions; show pending and error states.

### `Badge` — `BadgeProps`

`variant?: string` (free string; unknown values fall back to neutral) and
`children`. A small tinted label.

## Types

`Primitives` is the full registry interface; `PrimitivesProviderProps` is
`{ primitives: Partial<Primitives>; children }`. Every component's prop type is
exported (`ButtonProps`, `LinkButtonProps`, `AnyButtonProps`, `TextInputProps`,
`TextareaProps`, `SelectProps`, `SelectGroupsProps`, `AnySelectProps`,
`SelectOption`, `SelectGroup`, `CheckboxProps`, `TooltipProps`, `DialogProps`,
`ConfirmDialogProps`, `BadgeProps`).
