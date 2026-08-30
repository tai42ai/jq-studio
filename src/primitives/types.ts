/**
 * The prop contracts for jq-studio's nine UI primitives, and the {@link Primitives}
 * registry a host may substitute through {@link PrimitivesProvider}.
 *
 * jq-studio renders its editor chrome out of exactly nine small controls —
 * `Button`, `TextInput`, `Textarea`, `Select`, `Checkbox`, `Tooltip`, `Dialog`,
 * `ConfirmDialog`, `Badge`. Each ships as a minimal, accessible built-in (see
 * `builtin.tsx`), and each is looked up through React context so a host — the
 * tai42 Studio SDK, or any app — can inject its own design-system component in its
 * place WITHOUT jq-studio depending on that design system. The prop surfaces below
 * are the seam: they are the minimal-but-sufficient shape every call site inside
 * jq-studio relies on, so a host override only has to honour these.
 */
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentType,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from 'react';

// -- Button ------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** The action (button) form: native button attributes plus a variant. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly ref?: Ref<HTMLButtonElement>;
}

/** The link form: an `href` turns the control into an anchor styled as a button. */
export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly variant?: ButtonVariant;
  readonly href: string;
}

export type AnyButtonProps = (ButtonProps & { readonly href?: undefined }) | LinkButtonProps;

// -- Text controls -----------------------------------------------------------

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  readonly ref?: Ref<HTMLInputElement>;
};

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  readonly ref?: Ref<HTMLTextAreaElement>;
};

// -- Select ------------------------------------------------------------------

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** A labelled cluster of options. */
export interface SelectGroup {
  readonly label: string;
  readonly options: readonly SelectOption[];
}

interface SelectSharedProps {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly 'aria-label'?: string;
}

export interface SelectProps extends SelectSharedProps {
  readonly options: readonly SelectOption[];
}

export interface SelectGroupsProps extends SelectSharedProps {
  readonly groups: readonly SelectGroup[];
}

/** Exactly one of `options` or `groups`, never both. */
export type AnySelectProps =
  | (SelectProps & { readonly groups?: undefined })
  | (SelectGroupsProps & { readonly options?: undefined });

// -- Checkbox ----------------------------------------------------------------

export interface CheckboxProps {
  readonly checked?: boolean | 'indeterminate';
  readonly defaultChecked?: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly 'aria-label'?: string;
  readonly name?: string;
  readonly value?: string;
}

// -- Tooltip -----------------------------------------------------------------

export interface TooltipProps {
  readonly content: ReactNode;
  /** The element the bubble describes; a single element, not a string. */
  readonly children: ReactElement;
  readonly delayDuration?: number;
}

// -- Dialog ------------------------------------------------------------------

export interface DialogProps {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly trigger?: ReactElement;
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Fill the viewport edge to edge instead of centring a fixed-size panel. */
  readonly fullscreen?: boolean;
  /** A class merged onto the content element (a host hangs its scoping root here). */
  readonly contentClassName?: string;
  /** Drop the visible title + stack wrapper; render children directly. The title
   *  still names the dialog (visually hidden). */
  readonly chromeless?: boolean;
}

// -- ConfirmDialog -----------------------------------------------------------

export interface ConfirmDialogProps {
  readonly title: string;
  readonly confirmLabel: string;
  readonly pendingLabel: string;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
  readonly isPending: boolean;
  readonly error?: Error | string | null;
  readonly confirmVariant?: 'primary' | 'danger';
  readonly children: ReactNode;
}

// -- Badge -------------------------------------------------------------------

export interface BadgeProps {
  readonly variant?: string;
  readonly children: ReactNode;
}

// -- The injectable registry -------------------------------------------------

/**
 * The nine primitives jq-studio renders through. A host passes a partial override
 * to {@link PrimitivesProvider}; anything it omits keeps jq-studio's built-in.
 */
export interface Primitives {
  readonly Button: ComponentType<AnyButtonProps>;
  readonly TextInput: ComponentType<TextInputProps>;
  readonly Textarea: ComponentType<TextareaProps>;
  readonly Select: ComponentType<AnySelectProps>;
  readonly Checkbox: ComponentType<CheckboxProps>;
  readonly Tooltip: ComponentType<TooltipProps>;
  readonly Dialog: ComponentType<DialogProps>;
  readonly ConfirmDialog: ComponentType<ConfirmDialogProps>;
  readonly Badge: ComponentType<BadgeProps>;
}
