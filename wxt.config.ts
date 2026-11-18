import { defineConfig } from 'wxt';

// The manifest is generated from this file plus package.json (version, description).
// Every permission has a justification in store/listing.md.
export default defineConfig({
  manifest: {
    // Working name; the store listing (store/listing.md) and README use the same one.
    name: 'My Subtitles for YouTube',
    short_name: 'My Subtitles',
    // storage: the user's subtitle languages, on this device only.
    permissions: ['storage'],
    // Content scripts in the MAIN world (the player bridge) need Chrome 111.
    minimum_chrome_version: '120',
  },
  // Readable output: you (and store reviewers) can diff the shipped zip against the source.
  vite: () => ({ build: { minify: false } }),
  zip: { artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip' },
});
