# Changelog

All notable public changes to App Stylr are documented here. The project follows [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Optional Balanced composition guidance for transparent headers, charcoal surface reveals, stable navigation, darker background media, and reduced-motion behavior. Shared tokens and generated adapters are unchanged.

### Changed

- Updated the optional icon gradient and generated exports to the approved C / Evening treatment, retaining the original broad gradient with darker, less saturated colors. Added self-contained favicon and small-size guidance.

## [1.2.0] - 2026-09-19

### Added

- A 9px button radius token in the CSS and Swift adapters, retaining the 8px input/control and 12px card radii.
- Migration guidance for the charcoal and mint visual update.

### Changed

- Refined dark semantic colors to neutral charcoal surfaces, warmer primary text, and clearer strong borders while preserving the mint accent and all semantic roles.
- Applied the charcoal panel composition to the public Reference with compact introductions, grouped sections, and responsive layouts.
- Regenerated the CSS, Swift, and Chrome-theme artifacts from the canonical tokens. Light theme colors remain unchanged.

This source version is prepared for release. A main-branch update does not publish a tag or an npm package.

## [1.1.0] - 2026-09-17

### Added

- Public README guidelines and a reusable public-product README template for consistent product documentation.
- A portable `app-stylr-reference` command that builds the versioned Reference at a configurable canonical URL and base path without duplicating its source.
- A concise first-use CSS path, progressive help, and contextual privacy guidance in the public Reference.
- Plain-language data handling, local storage, deletion, permission, and hosting details for the Reference and command-line tools.
- A design-practice guide that separates shared semantic foundations from product-owned composition.
- Migration guidance for adopting the less prescriptive v1.1 design contract.

### Changed

- Made the portfolio `/app-stylr` route the canonical product and Reference URL.
- Marked visual component examples as static specimens so inert controls no longer create misleading keyboard stops.
- Replaced sync-oriented sample feedback with local generation, unsupported-input, permission, and check-only examples.
- Reframed the Reference specimens as examples rather than canonical layouts.
- Made initial theme, typography, spacing, radius, icon construction, responsive composition, and the Game Interface recipe explicitly optional product decisions.
- Limited consumer exception tracking to shared semantic and compatibility changes instead of ordinary layout differences.
- Reworked consumer and public README guidance around outcomes rather than screenshot or template resemblance.

### Fixed

- Updated Sharp to 0.35.4 to include the current libheif security fixes used by the public icon-generation commands.

## [1.0.0] - 2026-09-10

### Added

- Public package metadata and explicit exports for CSS, fonts, tokens, assets, templates, Chrome-theme files, and package metadata.
- Clean-install verification of the packed npm artifact, exports, commands, and complete web example.
- Public quickstarts, package interface, CLI, compatibility, generated-file, conventions, privacy, support, security, contribution, and release documentation.
- A complete framework-free web example and a raw-color-to-semantic-token migration example.
- Automated privacy checks for local paths, private governance artifacts, package contents, and site contents.
- MIT license.

### Changed

- Positioned App Stylr as a reusable foundation for independent web, browser-extension, and macOS developers.
- Distinguished the mandatory compatibility contract from optional visual and release recommendations.
- Made the Chrome-theme generator usable from an installed package with an explicit output directory.
- Replaced application-specific icon and reference copy with public-safe examples.
- Separated local Keychain signing from trust-independent CI signing in the optional Sparkle release guidance.
- Consolidated the public Visual Reference and Style Guide into one page and removed game-specific material from the deployed reference artifact.
- Made the site root the canonical Reference URL and retained permanent redirects for previous `/reference` paths.

### Removed

- Private application-family and consumer registries from the repository and package.
- Sibling-checkout fleet audit tooling and local-machine assumptions.
- Application-specific metadata, private governance documentation, naming policy, and release examples from the public surface.
- The `app-stylr/family` package export.

### Migration

See [Migrating to App Stylr v1.0.0](./docs/migrations/v1.0.0.md).

## 0.5.0 - Internal draft, not tagged

### Added

- Optional Game Interface profile for canvas-first browser games.
- Generated game sizing tokens for CSS and Swift.
- Expanded macOS Sparkle release validation guidance.

## 0.4.0 - Internal release, archived

### Added

- Versioned metadata support used by early adopters.

## 0.3.0 - Internal release, archived

### Added

- Expanded adoption templates and operational guidance.

## 0.2.0 - Internal release, archived

### Added

- Rendered Style Guide, bundled Geist fonts, generated Chrome theme, platform icon exporter, and release documentation.

## 0.1.0 - Internal release, archived

### Added

- Canonical JSON tokens, generated CSS and Swift adapters, validation, templates, and the initial visual reference.
