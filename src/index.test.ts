import { describe, it, expect } from 'vitest';
import * as jqStudio from './index';

/**
 * The public entry is the ONE seam the host imports through. This pins the
 * surface so a rename or accidental drop of an export is caught here rather than
 * in the host build.
 */
describe('@tai42/jq-studio public entry', () => {
  it('exposes the drop-in field and the embeddable editor surface', () => {
    expect(jqStudio.JqField).toBeDefined();
    expect(jqStudio.JQEditorDialog).toBeDefined();
    // The neutral alias is the documented name for deep integrations.
    expect(jqStudio.JqEditorDialog).toBe(jqStudio.JQEditorDialog);
    expect(typeof jqStudio.JQEditorProvider).toBe('function');
    expect(typeof jqStudio.useJQEditorState).toBe('function');
    expect(jqStudio.TransformerPreview).toBeDefined();
    expect(jqStudio.TransformerEditor).toBeDefined();
  });

  it('exposes the primitives-injection seam', () => {
    expect(typeof jqStudio.PrimitivesProvider).toBe('function');
    expect(typeof jqStudio.usePrimitives).toBe('function');
    expect(typeof jqStudio.builtinPrimitives.Button).toBe('function');
    expect(typeof jqStudio.builtinPrimitives.Dialog).toBe('function');
    expect(typeof jqStudio.installDefaultJqWorker).toBe('function');
    expect(typeof jqStudio.setJqWorkerFactory).toBe('function');
  });

  it('exposes the runtime, converters, and graph model', () => {
    expect(typeof jqStudio.preloadJq).toBe('function');
    expect(typeof jqStudio.runJq).toBe('function');
    expect(typeof jqStudio.convertJQToFlow).toBe('function');
    expect(typeof jqStudio.convertFlowToJQ).toBe('function');
    expect(jqStudio.JQNodeType.Start).toBe('jqStart');
    expect(jqStudio.ValueType.String).toBe('string');
  });

  it('exposes the node vocabulary and the guard API', () => {
    expect(jqStudio.ALL_JQ_NODE_KINDS.length).toBe(8);
    expect(typeof jqStudio.legendJqKindRows).toBe('function');
    expect(jqStudio.JQ_KIND_REGISTRY[jqStudio.JQNodeType.Start].builderCaption).toBe('Input');
    expect(typeof jqStudio.canRepresentFaithfully).toBe('function');
    expect(typeof jqStudio.checkJqValidity).toBe('function');
    expect(typeof jqStudio.roundTripVerdict).toBe('function');
    expect(typeof jqStudio.clearRoundTripVerdictCache).toBe('function');
  });
});
