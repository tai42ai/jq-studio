import { describe, it, expect } from 'vitest';
import { JQNodeType } from './enums';
import { JQ_KIND_REGISTRY, ALL_JQ_NODE_KINDS, legendJqKindRows } from './jq-kind-registry';

describe('jq kind registry completeness', () => {
  it('has exactly one entry per JQNodeType', () => {
    const kinds = Object.values(JQNodeType);
    expect(Object.keys(JQ_KIND_REGISTRY).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) {
      const entry = JQ_KIND_REGISTRY[kind];
      expect(entry.builderCaption.length).toBeGreaterThan(0);
      expect(entry.plainCaption.length).toBeGreaterThan(0);
      expect(entry.color).toMatch(/^var\(--jq-color-[a-z-]+\)$/);
      expect(entry.badge.length).toBeGreaterThan(0);
      expect(entry.gloss.length).toBeGreaterThan(0);
      expect(typeof entry.icon).toBe('object');
    }
  });

  it('enumerates every kind exactly once, in presentation order', () => {
    expect([...ALL_JQ_NODE_KINDS].sort()).toEqual([...Object.values(JQNodeType)].sort());
    expect(new Set(ALL_JQ_NODE_KINDS).size).toBe(ALL_JQ_NODE_KINDS.length);
    // Data kinds lead (Input first), Notes trail (Comment last).
    expect(ALL_JQ_NODE_KINDS[0]).toBe(JQNodeType.Start);
    expect(ALL_JQ_NODE_KINDS.at(-1)).toBe(JQNodeType.Comment);
  });

  it('binds the ruled semantic hues (F1) and the Input caption (F5)', () => {
    // F5: the root node is captioned "Input", not "Start".
    expect(JQ_KIND_REGISTRY[JQNodeType.Start].builderCaption).toBe('Input');
    // F1: Operator is muted (data), Define Function is primary + `Def` badge.
    expect(JQ_KIND_REGISTRY[JQNodeType.Operator].color).toBe('var(--jq-color-text-muted)');
    expect(JQ_KIND_REGISTRY[JQNodeType.FunctionDecl].color).toBe('var(--jq-color-primary)');
    expect(JQ_KIND_REGISTRY[JQNodeType.FunctionDecl].badge).toBe('Def');
    // Semantic anchors shared with the flow canvas.
    expect(JQ_KIND_REGISTRY[JQNodeType.Condition].color).toBe('var(--jq-color-warning)');
    expect(JQ_KIND_REGISTRY[JQNodeType.TryCatch].color).toBe('var(--jq-color-danger)');
    expect(JQ_KIND_REGISTRY[JQNodeType.Start].color).toBe('var(--jq-color-primary)');
    expect(JQ_KIND_REGISTRY[JQNodeType.FunctionCall].color).toBe('var(--jq-color-primary)');
    // Value literals no longer sit on `warning` (the light-theme brown-bar bug).
    expect(JQ_KIND_REGISTRY[JQNodeType.Value].color).toBe('var(--jq-color-text-muted)');
  });

  it('generates one legend row per kind from the registry', () => {
    const rows = legendJqKindRows();
    expect(rows.map((r) => r.kind)).toEqual([...ALL_JQ_NODE_KINDS]);
    for (const row of rows) {
      const entry = JQ_KIND_REGISTRY[row.kind];
      expect(row.caption).toBe(entry.builderCaption);
      expect(row.plainCaption).toBe(entry.plainCaption);
      expect(row.badge).toBe(entry.badge);
      expect(row.gloss).toBe(entry.gloss);
      expect(row.icon).toBe(entry.icon);
    }
  });
});
