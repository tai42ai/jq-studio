/**
 * Public entry of `@tai42/jq-studio` — the standalone, embeddable visual jq
 * editor. Any app imports from here: the drop-in `JqField`, the lower-level
 * `JqEditorDialog` for deep integrations, the round-trip AST converters, the
 * faithfulness/validity guard, the graph model, and the primitives-injection
 * seam a host uses to substitute its own design-system components.
 *
 * jq-studio depends on NO design system of its own — it renders through nine
 * small built-in primitives (see `PrimitivesProvider`) — and on no host, so the
 * same package serves the tai42 Studio SDK and any third-party consumer alike.
 *
 * The build extracts all styling reachable from here into a single
 * `@tai42/jq-studio/styles.css`; the built JS pulls in no CSS at runtime, so a
 * consumer imports that stylesheet explicitly (see the README).
 */
import './styles.css';

// --- The drop-in field ----------------------------------------------------
export { JqField } from './JqField';
export type { JqFieldProps } from './JqField';

// --- The embeddable editor + canvas surface -------------------------------
export { JQEditorDialog, JQEditorDialog as JqEditorDialog } from './JQEditorDialog';
export type {
  JQEditorDialogProps,
  JQEditorDialogProps as JqEditorDialogProps,
} from './JQEditorDialog';
export { JQEditorProvider, useJQEditorState } from './editor-context';
export { TransformerPreview } from './TransformerPreview';
export { TransformerEditor } from './transformer-editor';

// --- Primitives injection (a host substitutes its own components) ---------
export { PrimitivesProvider, usePrimitives, builtinPrimitives } from './primitives';
export type {
  Primitives,
  PrimitivesProviderProps,
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
} from './primitives';

// --- jq WASM runtime ------------------------------------------------------
export { preloadJq, runJq } from './utils/jq-loader';
export type { JqResult } from './utils/jq-loader';
export { setJqWorkerFactory } from './utils/jq-worker-client';
export type { JqWorkerFactory } from './utils/jq-worker-client';
export { installDefaultJqWorker } from './utils/install-default-worker';

// --- Graph model + round-trip converters ----------------------------------
export { JQNodeType, ValueType } from './enums';
export type { JQNodeData, JQNode, JQEdge, TransformersProps } from './types';
export { convertJQToFlow } from './utils/converters/flow-from-jq';
export { convertFlowToJQ } from './utils/converters/jq-from-flow';

// --- Node vocabulary (kind registry) --------------------------------------
export { JQ_KIND_REGISTRY, ALL_JQ_NODE_KINDS, legendJqKindRows } from './jq-kind-registry';
export type { JqKindEntry, JqKindIcon, JqKindIconProps } from './jq-kind-registry';

// --- Agnostic field declaration -------------------------------------------
export type {
  ExpressionLanguage,
  JqInputKey,
  JqInputShapeDescriptor,
  SampleInputProvider,
  ServerValidationResult,
  ServerValidateHook,
  JqFieldDeclaration,
} from './declaration';

// --- Faithfulness + validity guard API ------------------------------------
export {
  roundTripVerdict,
  clearRoundTripVerdictCache,
  checkJqValidity,
  canRepresentFaithfully,
} from './guard';
export type { RoundTripVerdict, JqValidity } from './guard';
