# Theme contract

jq-studio's editor styles are scoped under a single `.jq-studio-root` class and
read every colour, space, radius, type, and elevation value from a `--jq-*` CSS
custom property. `@tai42/jq-studio/styles.css` ships a self-contained default
theme that defines all of them (light and dark). **To adopt your app's palette,
redefine any of these tokens** on `:root` or on a `.jq-studio-root` element.

Tokens are declared on both `:root` and `.jq-studio-root`, so they resolve whether
you theme the whole document or only the editor subtree. The editor's portalled
surfaces (dialogs, tooltips) carry the `.jq-studio-root` class, so they follow the
same tokens.

## Light / dark

`prefers-color-scheme` is the default. A `data-theme` attribute pins the theme in
both directions:

```html
<html data-theme="dark">
  <!-- forces dark regardless of the OS preference -->
</html>
```

The theme is resolved with a fixed precedence (highest wins), so the outcome is
deterministic no matter where the stamp lives:

1. **`data-theme` on the element itself** — `:root`, or the `.jq-studio-root`
   element. A viewer's explicit pin.
2. **`data-theme` on an ancestor `:root`** (i.e. `document.documentElement`).
   Only the `:root` stamp is honored — a stamp on `<body>` or an app wrapper
   `<div>` reaches neither rung, because the editor dialog portals to
   `document.body` and escapes any wrapper below `<html>`.
   This is the common host pattern: the app stamps the theme on `<html>` while
   the editor's dialogs/tooltips are **portalled to `document.body`**. Those
   portalled surfaces carry `.jq-studio-root` but no `data-theme` of their own,
   so they **inherit the ancestor stamp** rather than fall through to the OS. An
   ancestor stamp therefore governs the portalled canvas in both directions —
   `<html data-theme="light">` keeps the editor light even when the OS prefers
   dark, and vice-versa.
3. **`prefers-color-scheme`** — the OS preference, used when no `data-theme`
   governs.
4. **The light default** — when the OS states no preference.

An own stamp always beats an ancestor stamp (a `.jq-studio-root data-theme`
overrides `<html>`), and an ancestor stamp always beats the OS preference.

`--jq-color-focus-ring` and `--jq-color-background` are aliases (of the accent and
the ground respectively) and carry no dark value of their own.

## The tokens

### Colours

| Token                       | What it colours                               | Light                | Dark                    |
| --------------------------- | --------------------------------------------- | -------------------- | ----------------------- |
| `--jq-color-bg`             | The page/canvas ground                        | `#ffffff`            | `#0c0e12`               |
| `--jq-color-background`     | Alias of `--jq-color-bg` (fallback)           | = bg                 | = bg                    |
| `--jq-color-surface`        | Panels, toolbars                              | `#f9fafb`            | `#12151b`               |
| `--jq-color-surface-raised` | Cards, controls, popovers, dialogs            | `#ffffff`            | `#171c24`               |
| `--jq-color-surface-sunken` | Hover/recessed grounds                        | `#eef0f3`            | `#0d1016`               |
| `--jq-color-code-bg`        | Code/expression readouts                      | `#f3f4f6`            | `#10131a`               |
| `--jq-color-border`         | Dividers, control borders                     | `#e5e7eb`            | `#262c36`               |
| `--jq-color-text`           | Body text                                     | `#111827`            | `#e6e8ec`               |
| `--jq-color-text-muted`     | Secondary text, glosses                       | `rgba(17,24,39,.62)` | `rgba(230,232,236,.64)` |
| `--jq-color-primary`        | Accent: primary buttons, selected marks       | `#dc143c`            | `#ed4c67`               |
| `--jq-color-primary-text`   | Label on a primary fill                       | `#ffffff`            | `#0c0e12`               |
| `--jq-color-danger`         | Error text, destructive controls              | `#b91c1c`            | `#f87171`               |
| `--jq-color-danger-text`    | Label on a danger fill                        | `#ffffff`            | `#0c0e12`               |
| `--jq-color-success`        | Success text/marks                            | `#047857`            | `#34d399`               |
| `--jq-color-warning`        | Warning text/marks                            | `#92400e`            | `#fbbf24`               |
| `--jq-color-focus-ring`     | Focus outline (alias of `--jq-color-primary`) | = primary            | = primary               |

### Spacing (multiples of 4px)

| Token          | Value            |
| -------------- | ---------------- |
| `--jq-space-1` | `0.25rem` (4px)  |
| `--jq-space-2` | `0.5rem` (8px)   |
| `--jq-space-3` | `0.75rem` (12px) |
| `--jq-space-4` | `1rem` (16px)    |

### Radius

| Token              | Value   |
| ------------------ | ------- |
| `--jq-radius-sm`   | `4px`   |
| `--jq-radius-md`   | `8px`   |
| `--jq-radius-full` | `999px` |

### Type

| Token            | Value                              |
| ---------------- | ---------------------------------- |
| `--jq-font-sans` | UI sans-serif stack                |
| `--jq-font-mono` | Monospace stack (expressions/code) |
| `--jq-text-lg`   | `0.9375rem` (15px)                 |
| `--jq-text-md`   | `0.84375rem` (13.5px)              |
| `--jq-text-sm`   | `0.78125rem` (12.5px)              |
| `--jq-text-code` | `0.75rem` (12px)                   |
| `--jq-text-xs`   | `0.6875rem` (11px)                 |

### Elevation, geometry, stacking

| Token                 | What it controls                | Default                       |
| --------------------- | ------------------------------- | ----------------------------- |
| `--jq-shadow-sm`      | Resting lift (cards, popovers)  | `0 12px 32px rgb(0 0 0 /.08)` |
| `--jq-shadow-md`      | Overlay lift (dialogs, menus)   | `0 24px 48px rgb(0 0 0 /.16)` |
| `--jq-control-height` | Button / input / select height  | `36px`                        |
| `--jq-z-dialog`       | Base stacking rung for overlays | `40`                          |

## Overriding

Redefine only what you need; unset tokens keep the default. Example — adopt an
app accent and force dark:

```css
:root {
  --jq-color-primary: #4f46e5;
  --jq-color-primary-text: #ffffff;
}
```

```html
<div class="jq-studio-root" data-theme="dark">…</div>
```

Because the tokens are plain custom properties, an inline `style` override on
`:root` (or on the `.jq-studio-root` element) also works and wins over the
stylesheet — useful for a runtime theme switcher.
