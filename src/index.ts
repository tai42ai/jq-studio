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
export type { JqFieldProps } from './JqField';
export { JqField } from './JqField';

// --- The embeddable editor + canvas surface -------------------------------
export { JQEditorProvider, useJQEditorState } from './editor-context';
export type {
  JQEditorDialogProps,
  JQEditorDialogProps as JqEditorDialogProps,
} from './JQEditorDialog';
export { JQEditorDialog, JQEditorDialog as JqEditorDialog } from './JQEditorDialog';
export { TransformerEditor } from './transformer-editor';
export { TransformerPreview } from './TransformerPreview';

// --- Primitives injection (a host substitutes its own components) ---------
export type {
  AnyButtonProps,
  AnySelectProps,
  BadgeProps,
  ButtonProps,
  ButtonVariant,
  CheckboxProps,
  ConfirmDialogProps,
  DialogProps,
  LinkButtonProps,
  Primitives,
  PrimitivesProviderProps,
  SelectGroup,
  SelectGroupsProps,
  SelectOption,
  SelectProps,
  TextareaProps,
  TextInputProps,
  TooltipProps,
} from './primitives';
export { builtinPrimitives, PrimitivesProvider, usePrimitives } from './primitives';

// --- jq WASM runtime ------------------------------------------------------
export { installDefaultJqWorker } from './utils/install-default-worker';
export type { JqResult } from './utils/jq-loader';
export { preloadJq, runJq } from './utils/jq-loader';
export type { JqWorkerFactory } from './utils/jq-worker-client';
export { setJqWorkerFactory } from './utils/jq-worker-client';

// --- Graph model + round-trip converters ----------------------------------
export { JQNodeType, ValueType } from './enums';
export type { JQEdge, JQNode, JQNodeData, TransformersProps } from './types';
export { convertJQToFlow } from './utils/converters/flow-from-jq';
export { convertFlowToJQ } from './utils/converters/jq-from-flow';

// --- Node vocabulary (kind registry) --------------------------------------
export type { JqKindEntry, JqKindIcon, JqKindIconProps } from './jq-kind-registry';
export { ALL_JQ_NODE_KINDS, JQ_KIND_REGISTRY, legendJqKindRows } from './jq-kind-registry';

// --- Agnostic field declaration -------------------------------------------
export type {
  ExpressionLanguage,
  JqFieldDeclaration,
  JqInputKey,
  JqInputShapeDescriptor,
  JqVariableDescriptor,
  SampleInputProvider,
  SampleVariablesProvider,
  ServerValidateHook,
  ServerValidationResult,
} from './declaration';

// --- Faithfulness + validity guard API ------------------------------------
export type { JqValidity, RoundTripVerdict } from './guard';
export {
  canRepresentFaithfully,
  checkJqValidity,
  clearRoundTripVerdictCache,
  roundTripVerdict,
} from './guard';
