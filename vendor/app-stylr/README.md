# App Stylr

An opinionated, adaptable design foundation for giving small web, browser-extension, and macOS products shared character without forcing them into one layout.

App Stylr provides semantic design tokens, generated CSS and Swift adapters, bundled Geist fonts, reusable icon assets, small command-line tools, public templates, and practical visual guidance. It deliberately does not provide a React component library, application state, authentication, deployment automation, or private product-fleet governance.

[View the public Visual Reference](https://kylbutlr.com/app-stylr), a single-page guide with a first-use CSS path, system principles, tokens, typography, themes, component specimens, responsive behavior, feedback, icon direction, and plain-language privacy details.

## Status

App Stylr v1.2.0 is the current source version, prepared for release. The installation examples below remain on v1.1.0 until a v1.2.0 tag is published. It preserves the v1 package interface while separating shared semantic foundations from product-owned composition. GitHub and Swift Package Manager installation require the matching immutable release tag. The npm package metadata is ready, but `app-stylr` has not been published to the npm registry.

- **GitHub releases:** [App Stylr releases](https://github.com/kylbutlr/app-stylr/releases)
- **npm:** prepared but not published
- **Swift Package Manager:** available from the public repository and semantic-version tag

Do not install from `main`. Pin an immutable release.

After the first approved npm release:

```sh
npm install app-stylr@1
```

From the current GitHub release tag:

```sh
npm install "github:kylbutlr/app-stylr#v1.1.0"
```

For Swift Package Manager, add `https://github.com/kylbutlr/app-stylr` with a dependency rule starting at `1.1.0`, then add the `AppStylr` product to your target.

## What App Stylr provides

- `tokens/app-stylr.json`, the canonical machine-readable token source
- `adapters/css/app-stylr.css`, generated light and dark semantic CSS variables
- `adapters/css/fonts.css`, generated font-face declarations for bundled Geist assets
- `adapters/swift/AppStylrTokens.swift`, the generated Swift and SwiftUI adapter
- `assets/`, reusable fonts, an icon base, and public example exports
- `templates/`, optional adoption, icon, manifest, and release templates
- `docs/public-readmes.md` and `templates/public-product-readme.md`, a shared public README standard and starting point
- `scripts/generate-icons.mjs`, the `app-stylr-icons` command
- `scripts/build-chrome-theme.mjs`, the `app-stylr-chrome-theme` command
- `scripts/validate-macos-release.mjs`, the `app-stylr-macos-release-check` command
- `scripts/build-site.mjs`, the `app-stylr-reference` command for producing a portable, versioned Reference artifact
- `chrome-theme/`, a generated unpacked Chrome theme
- `reference/`, the source for the public visual guide
- `docs/design-practice.md`, guidance for adapting the foundation without copying a canonical layout

Private family membership, consumer inventories, local checkout paths, rollout order, and per-application release operations are not part of App Stylr’s public interface. See [Public and private boundaries](./docs/public-boundary.md).

## Quick start

### Web

1. Install a pinned release.
2. Import the fonts and token adapter once in your application stylesheet.
3. Style against semantic roles, not raw palette colors.

```css
@import "app-stylr/fonts.css";
@import "app-stylr/css";

.panel {
  color: var(--ui-text);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-card);
  padding: var(--space-24);
}

.primary-action {
  min-height: var(--size-control);
  color: var(--ui-accent-text);
  background: var(--ui-accent);
  border-radius: var(--radius-button, var(--radius-control));
}
```

The generated CSS falls back to dark semantic values when no theme is set. That is implementation behavior, not a recommendation that every product begin in dark mode. Choose the initial theme from the use scene, and set `data-app-stylr-theme="light"` on the document or a subtree when light is the intended appearance.

```html
<html lang="en" data-app-stylr-theme="light">
```

Run the complete [public web example](./examples/web/README.md) to see installation, a minimal build, both themes, and semantic component styling.

### Browser extensions

Extension pages can use the same CSS adapter. Because extension content security policy and injected pages should not depend on remote resources, bundle the App Stylr CSS and fonts with the extension.

```css
@import "app-stylr/fonts.css";
@import "app-stylr/css";
```

For an injected interface, place the styles inside a Shadow DOM root so host-page styles do not rewrite the token contract. Follow the [browser-extension guide](./docs/browser-extensions.md).

Generate the standard Chrome extension and installable-web icon sizes from one square SVG or PNG:

```sh
npx app-stylr-icons --source assets/app-icon.svg --output public/icons
```

### Swift and SwiftUI

```swift
import AppStylr
import SwiftUI

struct SettingsPanel: View {
  private let theme = AppStylrTokens.dark

  var body: some View {
    Text("Settings")
      .foregroundStyle(theme.text)
      .padding(AppStylrTokens.spacing.space16)
      .background(theme.surface)
  }
}
```

The package declares Swift tools 5.9 and supports macOS 10.15, iOS 13, tvOS 13, and watchOS 6 or newer. App Stylr supplies values, not platform components, so native controls and platform interaction conventions remain authoritative.

## Package exports

| Export | Purpose |
| --- | --- |
| `app-stylr/css` | Generated CSS custom properties for both themes |
| `app-stylr/fonts.css` | Bundled Geist Sans and Geist Mono font faces |
| `app-stylr/tokens` | Canonical JSON token document |
| `app-stylr/assets/*` | Public fonts and reusable icon sources |
| `app-stylr/templates/*` | Optional adoption and platform templates |
| `app-stylr/chrome-theme/*` | Generated unpacked Chrome theme files |
| `app-stylr/package.json` | Package metadata for tooling |

The Swift module is distributed through Swift Package Manager as `AppStylr`; it is not a JavaScript export. See [Package interface](./docs/package-interface.md) for the complete interface, error behavior, and compatibility notes.

## Commands

| Command | Purpose |
| --- | --- |
| `app-stylr-icons` | Generate extension, favicon, Apple touch, and PWA PNGs from one square source |
| `app-stylr-chrome-theme` | Generate an unpacked App Stylr Chrome theme into a chosen directory |
| `app-stylr-macos-release-check` | Validate a macOS `Info.plist`, Sparkle appcast, and signed archive as one release set |
| `app-stylr-reference` | Build the versioned Reference for a chosen output directory and canonical URL |

Run any command with `--help` for usage. See [CLI reference](./docs/cli.md) for inputs, outputs, and failure modes.

Repository maintainers also have these scripts:

```sh
npm run build          # regenerate CSS and Swift adapters
npm run icons          # regenerate public reference icon sizes
npm run chrome-theme   # regenerate the checked-in Chrome theme
npm run site           # build the scoped public reference site in .site/
npm test               # validate tokens, generated files, docs, privacy, and site contents
npm run package:check  # pack and install the actual npm artifact in a clean fixture
```

## Generated files

Edit only `tokens/app-stylr.json` when changing token values. Then run `npm run build`. Do not hand-edit:

- `adapters/css/app-stylr.css`
- `adapters/swift/AppStylrTokens.swift`
- generated PNGs under `assets/platform-icons/reference/`
- files under `chrome-theme/`

`npm run build:check`, `npm run icons:check`, and `npm run chrome-theme:check` fail when generated output does not exactly match its source. See [Generated-file policy](./docs/generated-files.md).

## Conventions

The small mandatory contract is:

- use semantic roles such as `--ui-text`, `--ui-surface`, and `--ui-accent`;
- keep the App Stylr version pinned and upgrade deliberately;
- regenerate adapters instead of editing generated files;
- preserve equivalent semantic meanings when exposing both light and dark themes;
- meet the documented contrast and non-color communication requirements.

The following are optional recommendations:

- choose an initial theme from the product's real use scene;
- use the bundled Geist fonts when they suit the product voice;
- use the supplied spacing, radius, size, and motion scales as coordinated starting points;
- use the charcoal-to-mint icon construction;
- adopt the Game Interface profile for canvas-first browser games;
- use the provided Chrome theme and Sparkle release checks.

Product requirements and native platform conventions may override recommendations. Layouts, components, breakpoints, and navigation belong to the product and are not exceptions. Record only deliberate changes to shared semantic or compatibility contracts. See [Mandatory and optional conventions](./docs/conventions.md) and [Design practice](./docs/design-practice.md).

## Documentation

- [Complete web example](./examples/web/README.md)
- [Migration example from raw colors to semantic tokens](./examples/migration/README.md)
- [Design practice: shared foundation, product-owned composition](./docs/design-practice.md)
- [Balanced motion: transparent headers and darker media](./docs/balanced-motion.md)
- [Migrating to the charcoal and mint v1.2 styling](./docs/migrations/v1.2.0.md)
- [Migrating to the adaptive v1.1 guidance](./docs/migrations/v1.1.0.md)
- [Migrating to the public v1 interface](./docs/migrations/v1.0.0.md)
- [Browser-extension adoption](./docs/browser-extensions.md)
- [Platform icon exports](./docs/platform-icons.md)
- [Game Interface profile](./docs/games.md)
- [macOS Sparkle validation](./docs/macos-sparkle.md)
- [Public README guidelines](./docs/public-readmes.md)
- [Public product README template](./templates/public-product-readme.md)

## Versioning and upgrades

App Stylr follows semantic versioning:

- patch releases clarify or correct behavior without changing the public interface;
- minor releases add backward-compatible tokens, assets, templates, or tooling;
- major releases remove or rename exports, tokens, commands, or semantic meanings.

Consumers should pin a release, read the matching migration note and changelog, regenerate or refresh adopted artifacts, run their own tests, and visually compare affected states. See [Compatibility and upgrades](./docs/compatibility.md) and [Release process](./docs/releases.md).

## Development

Requires Node.js 20 or newer. Swift verification requires an installed Swift 5.9-compatible toolchain.

```sh
npm ci
npm test
swift build
```

To inspect the reference site locally:

```sh
npm run site
npm run reference
```

Open [http://localhost:4187/](http://localhost:4187/).

## Support

Use the [support guide](./SUPPORT.md) for help and the [issue tracker](https://github.com/kylbutlr/app-stylr/issues) for reproducible bugs or proposals. Follow [SECURITY.md](./SECURITY.md) for vulnerability reports, and review [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a change.

Never include credentials, private repository details, or confidential application data in a public issue.

Additional project references include the [changelog](./CHANGELOG.md) and [public-surface privacy audit](./docs/privacy.md).

## License

App Stylr is available under the [MIT License](./LICENSE).
