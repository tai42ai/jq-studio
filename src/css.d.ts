/**
 * Side-effect stylesheet imports carry no module shape — declare them so the
 * TypeScript program accepts the `import './transformers.css'` the bundler
 * extracts into the library's one built `styles.css` asset.
 */
declare module '*.css';
