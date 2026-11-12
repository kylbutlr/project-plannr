# Package interface

## JavaScript and CSS exports

| Export | Format | Stability |
| --- | --- | --- |
| `app-stylr/css` | CSS | Public, generated |
| `app-stylr/fonts.css` | CSS | Public, generated |
| `app-stylr/tokens` | JSON | Public, canonical |
| `app-stylr/assets/*` | Fonts and SVG/PNG files | Public assets |
| `app-stylr/templates/*` | JSON, HTML, Markdown, TOML | Public templates |
| `app-stylr/chrome-theme/*` | JSON and PNG files | Public generated theme |
| `app-stylr/package.json` | JSON | Tooling metadata |

Imports outside these exports are unsupported. Repository validation rejects the return of private registry exports.

App Stylr apps are dark mode first, with dark mode as the default and an optional light mode toggle. The CSS adapter defines dark semantic values on `:root` and `[data-app-stylr-theme="dark"]`. A consuming app may provide a toggle that sets `data-app-stylr-theme="light"`; the light selector overrides semantic values without changing token names. App Stylr provides the theme values; the app implements the toggle. The JSON token document is useful for generators and validation, but applications should prefer an adapter rather than duplicating conversion logic.

Optional `data-app-stylr-accent` values `ember`, `blue` (Slate), `royal`, `amber`, and `monochrome` select an interaction palette without replacing neutrals. `"mint"` restores Sage. Independently, `data-app-stylr-tone` accepts `lighter`, `normal`, and `darker` for the six neutral roles. Omission uses Normal. Set theme, accent, and tone on the same root, including independently themed islands. See [accent palettes and surface tones](./accent-palettes.md).

## Swift interface

Swift Package Manager exposes one library product and module, both named `AppStylr`. `AppStylrTokens` provides the version, brand, typography, spacing, icon, profile, and light/dark semantic values.

`AppStylrTokens.Accents.Ember`, `.Blue` (Slate), `.Royal`, `.Amber`, and `.Monochrome` provide complete light/dark themes using Normal surfaces alongside the original defaults. `AppStylrTokens.theme(appearance: .dark, accent: .royal, tone: .lighter)` composes an accent and surface tone. Its `Appearance`, `Accent`, and `SurfaceTone` enums provide typed choices; omitted arguments use dark, Sage, and Normal.

Swift tools 5.9 is the package floor. Declared platform floors are macOS 10.15, iOS 13, tvOS 13, and watchOS 6.

## Command interface

The package installs four commands. Successful commands exit with status 0. Invalid arguments, missing inputs, unsupported states, permission failures, stale generated files, or failed validation exit non-zero and write an error to standard error. Commands do not read private registries or sibling repositories, make network requests, or send telemetry.

`app-stylr-reference` is the supported interface for hosting the versioned public Reference below another site. Consumers must provide a dedicated output directory and may set the canonical URL and base path without copying or editing the Reference source.

See [CLI reference](./cli.md).

## Data and permissions

App Stylr has no account or hosted data store. Installed files remain in the consuming project. Commands read only the paths supplied by the user or the documented repository defaults, and write only to their documented output directories. They do not request platform permissions beyond local file access.

See [Privacy](./privacy.md) for command-specific storage, network, and deletion details.

## Optional native-control recipe

`app-stylr/controls.css` opts in through `data-app-stylr-controls`. It is independent of generated token adapters and includes no JavaScript. See [form controls](form-controls.md) for the browser fallback contract.
