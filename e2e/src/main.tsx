/**
 * The bare consumer page for @tai42/jq-studio's end-to-end suite — and the repo's
 * living example. It uses ONLY the package's public surface: `JqField`,
 * `PrimitivesProvider`, and the `styles.css` stylesheet. No tai42 host, no design
 * system. Three scenarios sit side by side:
 *
 *   #default   — a plain controlled `JqField` (the 5-line quickstart).
 *   #injected  — the same field with a host-supplied Button injected through
 *                `PrimitivesProvider`, proving the design-system-agnostic seam.
 *   #theme     — a probe coloured by `var(--jq-color-primary)` plus a control that
 *                overrides that token on :root, proving the theme contract.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JqField, PrimitivesProvider } from '@tai42/jq-studio';
import type { AnyButtonProps } from '@tai42/jq-studio';
import '@tai42/jq-studio/styles.css';

/** A host's own button — visibly distinct, tagged so the test can find it. */
function HostButton(props: AnyButtonProps) {
  if (props.href !== undefined) return <a {...props} />;
  const { variant: _variant, ...rest } = props;
  return <button {...rest} data-testid="host-button" style={{ padding: '6px 10px' }} />;
}

function DefaultScenario() {
  const [value, setValue] = useState('.value + 1');
  return (
    <section id="default">
      <h2>Default</h2>
      <JqField label="Transform" value={value} onChange={setValue} />
      <pre data-testid="default-value">{value}</pre>
    </section>
  );
}

function InjectedScenario() {
  const [value, setValue] = useState('.value');
  return (
    <section id="injected">
      <h2>Injected primitives</h2>
      <PrimitivesProvider primitives={{ Button: HostButton }}>
        <JqField label="Injected" value={value} onChange={setValue} />
      </PrimitivesProvider>
    </section>
  );
}

function ThemeScenario() {
  return (
    <section id="theme">
      <h2>Theme contract</h2>
      <div data-testid="theme-probe" style={{ color: 'var(--jq-color-primary)' }}>
        primary token probe
      </div>
      <button
        type="button"
        data-testid="apply-theme"
        onClick={() => {
          document.documentElement.style.setProperty('--jq-color-primary', 'rgb(16, 185, 129)');
        }}
      >
        Override --jq-color-primary
      </button>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main style={{ display: 'grid', gap: '2rem', padding: '2rem', maxWidth: 720 }}>
      <h1>@tai42/jq-studio consumer example</h1>
      <DefaultScenario />
      <InjectedScenario />
      <ThemeScenario />
    </main>
  </StrictMode>,
);
