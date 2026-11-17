# App Stylr agent contract

App Stylr is a public, framework-neutral design foundation for small web, browser-extension, and macOS products.

## Public interface

- `tokens/app-stylr.json` is canonical.
- CSS and Swift adapters are generated. Never edit them directly.
- Public package exports, commands, compatibility, and errors are documented in `docs/package-interface.md` and `docs/cli.md`.
- The public site may include only reusable guides, adapters, and assets selected by `scripts/build-site.mjs`.
- Private family membership, consumer inventories, sibling checkout paths, rollout state, application credentials, and per-application operations must stay outside this repository.

## Required workflow

1. Change canonical design values only in `tokens/app-stylr.json`.
2. Run `npm run build` after token changes.
3. Run `npm run icons` after changing the public example icon or icon export contract.
4. Run `npm run chrome-theme` after changing tokens or the Chrome-theme contract.
5. Update public documentation, examples, and migration guidance when the interface changes.
6. Follow `docs/public-readmes.md` for public README changes and use `templates/public-product-readme.md` as the starting point for new products.
7. Follow `docs/design-practice.md` when deciding whether guidance belongs to the shared foundation or the product.
8. Run `npm run site` after changing the reference pages or public site inputs.
9. Run `npm test`, `npm run package:check`, and `swift build` before release preparation.
10. Inspect the single Reference page at desktop and phone widths after visual changes.
11. Update `CHANGELOG.md` for changes visible to consumers.

## Guardrails

- Use semantic theme roles in examples.
- Default App Stylr apps to dark mode. A product-owned light mode toggle is optional.
- Keep semantic meanings equivalent when a product exposes both light and dark themes.
- Preserve at least 4.5:1 contrast for normal text and 3:1 for large text and meaningful graphics.
- Keep the core interface framework-neutral.
- Add an adapter only when a real external use case requires it.
- Do not add a shared component library until repeated behavior justifies one.
- Keep mandatory compatibility rules separate from optional recommendations.
- Never require another repository or a sibling local checkout to install, build, or verify the package.
- Do not publish, deploy, tag, push, or change repository visibility without explicit approval.
