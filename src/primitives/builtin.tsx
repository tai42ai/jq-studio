/**
 * jq-studio's built-in UI primitives: small, accessible, token-styled controls
 * that carry the editor when no host injects its own. Every visual value is a
 * `--jq-*` theme token (see the theme contract in the README) so the built-ins
 * pick up a host's light/dark palette; the accessible modals, listbox, tooltip
 * and checkbox are Radix primitives (the same ones jq-studio already pulled in
 * transitively), so focus trapping, portalling and keyboard semantics are correct
 * without jq-studio reimplementing them.
 *
 * These are the DEFAULT set behind {@link PrimitivesProvider}; a host that has its
 * own design system substitutes any of them without jq-studio depending on it.
 */
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import * as RadixDialog from '@radix-ui/react-dialog';
import * as RadixSelect from '@radix-ui/react-select';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { useId, useRef } from 'react';

import type {
  AnyButtonProps,
  AnySelectProps,
  BadgeProps,
  ButtonVariant,
  CheckboxProps,
  ConfirmDialogProps,
  DialogProps,
  Primitives,
  SelectOption,
  TextInputProps,
  TextareaProps,
  TooltipProps,
} from './types';

// -- Button ------------------------------------------------------------------

const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'jqp-btn jqp-btn-primary',
  secondary: 'jqp-btn jqp-btn-secondary',
  ghost: 'jqp-btn jqp-btn-ghost',
  danger: 'jqp-btn jqp-btn-danger',
};

function buttonClass(variant: ButtonVariant, className: string | undefined): string {
  const base = BUTTON_VARIANT_CLASS[variant];
  return className ? `${base} ${className}` : base;
}

export function Button(props: AnyButtonProps) {
  if (props.href === undefined) {
    const { variant = 'secondary', className, href: _href, ...rest } = props;
    return <button {...rest} className={buttonClass(variant, className)} />;
  }
  const { variant = 'secondary', className, href, children, target, rel, ...rest } = props;
  // A new-tab link is hardened against reverse tabnabbing; property order pins
  // `rel` after the caller's spread so it cannot be dropped.
  const hardenedRel = target === '_blank' ? 'noopener noreferrer' : rel;
  return (
    <a
      {...rest}
      href={href}
      target={target}
      rel={hardenedRel}
      className={buttonClass(variant, className)}
    >
      {children}
    </a>
  );
}

// -- Text controls -----------------------------------------------------------

export function TextInput({ className, type = 'text', ...props }: TextInputProps) {
  return (
    <input {...props} type={type} className={className ? `jqp-input ${className}` : 'jqp-input'} />
  );
}

export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={className ? `jqp-textarea ${className}` : 'jqp-textarea'}
    />
  );
}

// -- Select ------------------------------------------------------------------

function OptionItem({ option }: { option: SelectOption }) {
  return (
    <RadixSelect.Item className="jqp-select-item" value={option.value} disabled={option.disabled}>
      <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="jqp-select-item-indicator">
        <Check aria-hidden size={14} />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}

export function Select(props: AnySelectProps) {
  const {
    value,
    defaultValue,
    onValueChange,
    placeholder = 'Select…',
    disabled,
    name,
    'aria-label': ariaLabel,
  } = props;
  if ((props.options === undefined) === (props.groups === undefined)) {
    throw new Error(
      'Select renders exactly one of `options` or `groups`; it was given both, or neither.',
    );
  }
  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <RadixSelect.Trigger className="jqp-select-trigger" aria-label={ariaLabel}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon aria-hidden="true">
          <ChevronDown size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="jqp-select-content" position="popper" sideOffset={4}>
          <RadixSelect.Viewport className="jqp-select-viewport">
            {props.groups !== undefined
              ? props.groups.map((group) => (
                  <RadixSelect.Group key={group.label}>
                    <RadixSelect.Label className="jqp-select-group-label">
                      {group.label}
                    </RadixSelect.Label>
                    {group.options.map((option) => (
                      <OptionItem key={option.value} option={option} />
                    ))}
                  </RadixSelect.Group>
                ))
              : props.options.map((option) => <OptionItem key={option.value} option={option} />)}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

// -- Checkbox ----------------------------------------------------------------

export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  'aria-label': ariaLabel,
  name,
  value,
}: CheckboxProps) {
  const id = useId();
  const box = (
    <RadixCheckbox.Root
      id={id}
      className="jqp-checkbox"
      aria-label={label === undefined ? ariaLabel : undefined}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(next) => {
        onCheckedChange?.(next === true);
      }}
      disabled={disabled}
      name={name}
      value={value}
    >
      <RadixCheckbox.Indicator aria-hidden="true" style={{ display: 'flex' }}>
        {checked === 'indeterminate' ? <Minus size={12} /> : <Check size={12} />}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
  if (label === undefined) return box;
  return (
    <label htmlFor={id} className="jqp-choice">
      {box}
      <span>{label}</span>
    </label>
  );
}

// -- Tooltip -----------------------------------------------------------------

export function Tooltip({ content, children, delayDuration = 200 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content sideOffset={4} className="jqp-tooltip">
            {content}
            <RadixTooltip.Arrow className="jqp-tooltip-arrow" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

// -- Dialog ------------------------------------------------------------------

// Focus return (WCAG 2.4.3). This Dialog is trigger-less and controlled, so Radix's
// default `onCloseAutoFocus` — `preventDefault(); triggerRef.current?.focus()` —
// restores focus to a null trigger: it focuses NOTHING and strands focus on
// `<body>` after close. The built-in editor must never rely on a host for focus
// return, so the Dialog captures its own opener on open and restores it on close.

/** Snapshot the opener (the focused element the dialog was opened from) plus its
 *  ancestor chain, taken at OPEN time because a closing dialog can unmount the
 *  opener itself — the ancestors are the fallbacks walked when it has. */
function captureOpenerChain(): HTMLElement[] {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return [];
  const chain: HTMLElement[] = [];
  for (let node: HTMLElement | null = active; node !== null; node = node.parentElement) {
    chain.push(node);
  }
  return chain;
}

/** The opener to restore, or null when nothing in the chain is a live focus
 *  target. `<body>`/`<html>` never count (focusing them is the very failure this
 *  guards against); the opener held focus so it restores when still connected and
 *  enabled, while an ancestor fallback must also be focusable in its own right. */
function firstRestorable(chain: readonly HTMLElement[]): HTMLElement | null {
  for (let i = 0; i < chain.length; i += 1) {
    const el = chain[i];
    if (el === undefined) continue;
    if (!el.isConnected || el === document.body || el === document.documentElement) continue;
    if ((el as HTMLButtonElement).disabled) continue;
    // The opener (i === 0) held focus, so it restores as-is; an ancestor fallback
    // must be focusable in its own right, else focusing it is a silent no-op.
    if (i > 0 && el.tabIndex < 0) continue;
    return el;
  }
  return null;
}

export function Dialog({
  title,
  description,
  children,
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  fullscreen = false,
  contentClassName,
  chromeless = false,
}: DialogProps) {
  const contentClasses = ['jqp-dialog'];
  if (fullscreen) contentClasses.push('jqp-dialog-fullscreen');
  if (contentClassName !== undefined) contentClasses.push(contentClassName);

  const openerChainRef = useRef<HTMLElement[]>([]);

  return (
    <RadixDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger !== undefined ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="jqp-overlay" />
        <RadixDialog.Content
          className={contentClasses.join(' ')}
          {...(description === undefined ? { 'aria-describedby': undefined } : {})}
          onOpenAutoFocus={() => {
            // Record the opener BEFORE Radix moves focus into the dialog; no
            // preventDefault, so Radix still focuses the first control inside.
            openerChainRef.current = captureOpenerChain();
          }}
          onCloseAutoFocus={(event) => {
            // Take over from Radix's null-trigger default (see the note above):
            // restore the opener, or — when it is gone, as for a stacked inner
            // dialog whose opener lived in the now-unmounting outer dialog — leave
            // focus where it is rather than fighting the outer dialog's own
            // restore. Either way, never fall through to focusing `<body>`.
            event.preventDefault();
            firstRestorable(openerChainRef.current)?.focus();
          }}
        >
          <RadixDialog.Title className={chromeless ? 'jqp-visually-hidden' : 'jqp-dialog-title'}>
            {title}
          </RadixDialog.Title>
          {chromeless ? (
            <>
              {description !== undefined ? (
                <RadixDialog.Description className="jqp-visually-hidden">
                  {description}
                </RadixDialog.Description>
              ) : null}
              {children}
            </>
          ) : (
            <div className="jqp-stack">
              {description !== undefined ? (
                <RadixDialog.Description className="jqp-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
              {children}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

// -- ConfirmDialog -----------------------------------------------------------

function errorMessage(error: Error | string): string {
  return typeof error === 'string' ? error : error.message;
}

export function ConfirmDialog({
  title,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onClose,
  isPending,
  error,
  confirmVariant = 'danger',
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {children}
      {error != null ? (
        <div className="jqp-error-state" role="alert">
          {errorMessage(error)}
        </div>
      ) : null}
      <div className="jqp-dialog-actions">
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant={confirmVariant} disabled={isPending} onClick={onConfirm}>
          {isPending ? <span className="jqp-spinner" aria-label={pendingLabel} /> : null}
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

// -- Badge -------------------------------------------------------------------

const BADGE_VARIANT_CLASS: Record<string, string> = {
  neutral: 'jqp-badge jqp-badge-neutral',
  primary: 'jqp-badge',
  info: 'jqp-badge jqp-badge-info',
  success: 'jqp-badge jqp-badge-ok',
  warning: 'jqp-badge jqp-badge-warn',
  danger: 'jqp-badge jqp-badge-err',
};

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span
      data-variant={variant}
      className={BADGE_VARIANT_CLASS[variant] ?? BADGE_VARIANT_CLASS.neutral}
    >
      {children}
    </span>
  );
}

/** The default primitive registry: jq-studio's own built-ins. */
export const builtinPrimitives: Primitives = {
  Button,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Tooltip,
  Dialog,
  ConfirmDialog,
  Badge,
};
