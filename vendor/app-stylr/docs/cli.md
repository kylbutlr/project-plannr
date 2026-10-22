# CLI reference

## Before you run a command

App Stylr commands run locally and do not upload inputs, outputs, or usage data. Pass `--help` to review a command before running it.

Three commands write to disk. Choose a dedicated output folder and commit or back up anything you need first:

- `app-stylr-icons` and `app-stylr-chrome-theme` may replace generated files at their expected output paths;
- `app-stylr-reference` removes and recreates the complete output directory;
- adding `--check` verifies existing generated output without changing it.

`app-stylr-macos-release-check` is read-only. It validates the files you name but does not sign, upload, publish, or modify them.

## `app-stylr-icons`

```sh
app-stylr-icons --source <square-image> --output <directory> [--check]
```

The source may be any square image format supported by the installed image processor. SVG and PNG are the simplest choices. The command writes deterministic Chrome extension, favicon, Apple touch, and PWA PNGs below the output directory. Existing files at those generated paths may be replaced. `--check` compares expected bytes without writing and fails when any file is missing or stale.

## `app-stylr-chrome-theme`

```sh
app-stylr-chrome-theme --output <directory> [--check]
```

The command creates an unpacked Manifest V3 Chrome theme from the package’s canonical dark tokens. It writes only inside the chosen output directory, replacing generated files at their expected paths when needed. `--check` verifies that an existing output matches the current generator without writing.

Repository maintainers may omit `--output`; the default is the checked-in `chrome-theme/` directory.

## `app-stylr-macos-release-check`

```sh
app-stylr-macos-release-check \
  --info-plist path/to/Info.plist \
  --appcast path/to/appcast.xml \
  --archive path/to/App-1.2.3.zip \
  [--root path/to/project]
```

The command checks semantic and numeric versions, HTTPS feed configuration, the Sparkle public key, signed-feed requirements, archive name and signature metadata, and ZIP integrity. It validates local release artifacts only. It does not sign, upload, deploy, or fetch a public feed.

## `app-stylr-reference`

```sh
app-stylr-reference \
  --output out/app-stylr \
  --canonical-url https://example.com/app-stylr \
  [--base-path /app-stylr]
```

The command builds a self-contained copy of the App Stylr Reference from the installed package. It copies only the public adapters and assets required by the page, writes a machine-readable `app-stylr-reference.json` manifest, and rewrites URLs for the requested host path. When `--base-path` is omitted, the canonical URL pathname is used.

Repository maintainers may omit all options to reproduce the canonical artifact in `.site/`. The output must be a dedicated child directory because the command removes and recreates that entire directory on each run.

## Messages and exit status

A successful command names the output it generated or the check it completed, then exits with status 0. Invalid options, missing files, unsupported inputs, permission failures, and stale generated output print an error to standard error and exit non-zero. The error identifies the affected input or output when the operating system provides that information.

No command requests browser, camera, microphone, contact, location, or account permissions. A write command only needs operating-system permission for the output folder you choose.

See [Privacy](./privacy.md) for the complete local data flow and deletion guidance.
