# Generated-file policy

`tokens/app-stylr.json` is the canonical source for design values. Generation is deterministic, so the same source and tool version must produce byte-identical tracked output.

| Source | Generated output | Command |
| --- | --- | --- |
| `tokens/app-stylr.json` | CSS and Swift adapters | `npm run build` |
| `assets/example-app-icon.svg` | Reference icon PNGs | `npm run icons` |
| tokens and public icon assets | Unpacked Chrome theme | `npm run chrome-theme` |
| reference source and public assets | `.site/` or another requested output directory | `npm run site` or `app-stylr-reference` |

Do not hand-edit generated outputs. Change the source or generator, regenerate, review the diff, and run the matching `:check` command. Generated adapters include the App Stylr version so a stale output is visible and testable.

The `.site/` directory is an ignored build artifact. It must contain only the Reference page, its version manifest, public adapters, and public assets selected by `scripts/build-site.mjs`. A consuming host should generate the same artifact into its own ignored or deployment-only output directory.
