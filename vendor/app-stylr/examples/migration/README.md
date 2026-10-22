# Migration example: raw colors to semantic roles

The [before stylesheet](./before.css) hard-codes the dark palette into one card. That works for one appearance but duplicates values and makes theme changes a component concern.

The [after stylesheet](./after.css) imports App Stylr and maps each declaration to a semantic or structural role. The component now works in both themes without its own theme branch.

## Migration sequence

1. Install and pin App Stylr.
2. Import `app-stylr/fonts.css` and `app-stylr/css` once.
3. Replace colors by meaning: text, surface, border, accent, and accent text.
4. Replace duplicated spacing, radius, and control sizes where the App Stylr role matches the existing intent.
5. Add `data-app-stylr-theme="light"` to a test container and inspect the component.
6. Verify focus, hover, disabled, error, and reduced-motion states.

Do not perform blind value replacement. A raw value may serve different meanings in different locations, so choose the semantic role from the component’s purpose.
