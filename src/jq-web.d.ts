/**
 * Ambient types for the `jq-web` package, which ships no type declarations.
 *
 * The package exports the Emscripten factory function (as both the default
 * export and a named `factory` export); calling it with an options object
 * returns a promise of the instantiated module. `locateFile` tells Emscripten
 * where to fetch the `.wasm` binary from.
 */
declare module 'jq-web' {
  export interface JqModule {
    /** Run `filter` over a parsed JSON `input`, returning the parsed result. */
    json(input: unknown, filter: string): unknown;
    /** Run `filter` over a raw JSON string, returning the raw string output. */
    raw(input: string, filter: string, flags?: string[]): string;
  }

  export interface JqFactoryOptions {
    /** Resolve a runtime asset (notably `jq.wasm`) to a fetchable URL. */
    locateFile?: (path: string, scriptDirectory: string) => string;
  }

  export type JqFactory = (moduleArg?: JqFactoryOptions) => Promise<JqModule>;

  export const factory: JqFactory;
  const _default: JqFactory;
  export default _default;
}
