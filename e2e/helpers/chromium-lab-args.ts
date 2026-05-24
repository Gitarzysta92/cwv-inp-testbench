/** Shared Chromium flags for lab runs — avoids macOS Keychain / Safe Storage prompts. */
export const chromiumLabArgs = [
  '--disable-background-networking',
  '--disable-component-extensions-with-background-pages',
  '--disable-extensions',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
  '--password-store=basic',
  // macOS: skip Keychain ("Chromium Safe Storage") — required for unattended CDP runs.
  '--use-mock-keychain',
];
