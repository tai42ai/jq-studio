// Register the jest-dom matchers (`toBeInTheDocument`, `toHaveTextContent`, …)
// on vitest's `expect`, used by the component tests.
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/* eslint-disable @typescript-eslint/no-empty-function --
   jsdom implements none of the layout/observer APIs the canvas and the Radix
   primitives touch; these stubs are intentionally inert (the tests assert on
   structure and behavior, not measured geometry). */

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// @xyflow/react reads a DOMMatrix off the pane transform; jsdom has none.
class DOMMatrixReadOnlyStub {
  readonly m22 = 1;
}
vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyStub);

// jq-studio makes no network calls of its own (the WASM runtime is local; a
// server-validate hook, if any, is injected by the host). Any fetch in a test
// is therefore unexpected — reject loudly rather than resolve silently.
vi.stubGlobal(
  'fetch',
  vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.reject(new Error(`unexpected fetch in test: ${url}`));
  }),
);

// Suites that run in the node environment (e.g. WASM execution) have no DOM;
// only patch these prototypes when jsdom actually provides `Element`.
if (typeof Element !== 'undefined') {
  // jsdom leaves `isContentEditable` undefined; derive it from the nearest
  // contenteditable host (attribute "true"/"" enables, "false" disables).
  if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'isContentEditable')) {
    Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
      configurable: true,
      get(this: HTMLElement): boolean {
        const host = this.closest('[contenteditable]');
        const value = host?.getAttribute('contenteditable');
        return value === '' || value?.toLowerCase() === 'true';
      },
    });
  }

  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return false;
  };
  Element.prototype.setPointerCapture = function setPointerCapture(): void {};
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {};
}
