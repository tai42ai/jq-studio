/**
 * The AGNOSTIC field-declaration surface of jq-studio.
 *
 * jq-studio is a standalone visual editor for a pipeline expression language; it
 * knows nothing about the product that embeds it. A host declares a jq field
 * through these generic types — a language tag, a DESCRIPTOR of what `.` is (not
 * an enum of shapes jq-studio hard-codes), a sample-input provider, and a
 * pluggable server-validate hook. A host adapter maps its own field/input
 * envelopes onto these; nothing here names anything host-specific, so the same
 * package serves any consumer's `.` document — a webhook body, an auth context,
 * a tool result — without a type change.
 *
 * That is the reason the surface is descriptor-based, not enum-based: no fixed
 * enum could name every consumer's `.` document.
 */

/** The expression language a jq-studio field authors. Only jq exists today; the
 *  tag keeps the declaration open to other pipeline languages without a
 *  host-side type change. */
export type ExpressionLanguage = 'jq';

/** One top-level key of the `.` document, with a one-line gloss the editor shows
 *  (context chip, Input-node body, path suggestions). */
export interface JqInputKey {
  readonly name: string;
  readonly gloss: string;
}

/**
 * A descriptor of what `.` IS for a field — the shape of the input document the
 * expression receives. Deliberately open: a host builds these from its own
 * domain, so ANY envelope is expressible, including ones jq-studio has never
 * heard of. The `id` is an opaque, host-namespaced string used only for
 * memoisation/telemetry.
 */
export interface JqInputShapeDescriptor {
  /** Stable, host-namespaced id (opaque to jq-studio). */
  readonly id: string;
  /** Short chip label — what `.` is here, e.g. "node envelope". */
  readonly label: string;
  /** One sentence: what `.` is in this field. */
  readonly blurb: string;
  /** The top-level keys of `.`, each with a one-liner. */
  readonly keys: readonly JqInputKey[];
  /** What the expression must RETURN, e.g. "true or false" | "an object". */
  readonly returns: string;
  /** Per-field caveats (e.g. ".iterate.item is always null in a while condition"). */
  readonly caveats?: readonly string[];
  /** A static skeleton of `.` — the cheap, honest default the Test panel seeds
   *  its input with (design fork F3). A host may override it dynamically via the
   *  declaration's {@link SampleInputProvider}; live samples are a later,
   *  additive concern. */
  readonly sample?: unknown;
}

/** A provider of a concrete sample input for the Test panel. A function (not a
 *  value) so a host can supply a static skeleton now (F3) and a live sample
 *  later without changing this API. */
export type SampleInputProvider = () => unknown;

/** The answer a pluggable validator gives for an expression against its declared
 *  shape. Mirrors a typical server validator's result WITHOUT importing its
 *  types, so the hook stays host-agnostic. */
export interface ServerValidationResult {
  readonly ok: boolean;
  readonly compiles?: boolean;
  readonly singleEmit?: boolean;
  readonly message?: string;
}

/** A pluggable server-validate hook. The Test panel calls it with the current
 *  expression and the sample input; the host routes it to its own validator
 *  (e.g. a server `validate_jq` endpoint). Absent = no server validation (the
 *  WASM runtime still powers Test locally). */
export type ServerValidateHook = (args: {
  expression: string;
  sampleInput: unknown;
}) => Promise<ServerValidationResult>;

/**
 * The declaration a host attaches to a jq field: the language, what `.` is
 * (descriptor), how to sample it, and how to server-validate it. Every property
 * beyond `language` is optional so adoption is incremental — an undeclared field
 * behaves exactly as before. No property names anything host-specific.
 */
export interface JqFieldDeclaration {
  readonly language: ExpressionLanguage;
  readonly shape?: JqInputShapeDescriptor;
  readonly sampleInput?: SampleInputProvider;
  readonly serverValidate?: ServerValidateHook;
}
