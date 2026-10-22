# Privacy

App Stylr is a static reference and a package of local design assets and command-line tools. It has no account system, hosted workspace, cloud sync, telemetry, or upload feature.

## At a glance

| Surface | What it handles | Where it stays | What leaves your device |
| --- | --- | --- | --- |
| Public Reference | A request for the page and its static assets | The page itself stores nothing in your browser | The web host receives the connection data needed to serve the page |
| CSS, fonts, tokens, assets, and templates | Files installed in your project | Your project and package-manager cache | Nothing sent by App Stylr |
| Icon and Chrome-theme commands | The local input and output paths you choose | The chosen local folders | Nothing sent by App Stylr |
| Reference generator | The local output folder you choose | The chosen local folder | Nothing sent by App Stylr |
| macOS release check | The local `Info.plist`, appcast, and archive paths you choose | The command reads them in place and does not retain a copy | Nothing sent by App Stylr |

## Public Reference

The Reference at [kylbutlr.com/app-stylr](https://kylbutlr.com/app-stylr) is static HTML and CSS. Its source contains no forms, account code, analytics scripts, cookies, browser storage, or application-data collection.

The page is delivered through Netlify. Like other web hosts, Netlify may process standard connection information such as an IP address, browser details, requested pages, and timestamps to operate and secure its service. See [Netlify's privacy statement](https://www.netlify.com/privacy/) for its current practices and privacy-request options.

Following a link to GitHub, npm, or another provider takes you to that provider. Its privacy terms then apply.

## Package and command-line tools

The published package contains local files and executable Node scripts. The four installed commands do not include network requests or telemetry:

- `app-stylr-icons` reads one local image and writes generated icons beneath the output folder you choose. Existing files at the expected icon paths may be replaced.
- `app-stylr-chrome-theme` writes generated theme files beneath the output folder you choose. Existing files at those paths may be replaced.
- `app-stylr-reference` replaces the dedicated output directory you choose, then writes the static Reference, its required assets, and its manifest.
- `app-stylr-macos-release-check` reads the local release files you name and validates them. It does not modify, upload, sign, or publish them.

Options ending in `--check` compare local generated files without changing them. Review the [CLI reference](./cli.md) before pointing a write command at an existing directory.

Installing App Stylr requires a request to GitHub or npm through your chosen package manager. Those services may record the download under their own policies. The App Stylr package does not send an install event or telemetry.

## Deleting data

The Reference does not save data in your browser, so there is nothing in the page to delete.

To remove App Stylr from a Node project, uninstall the dependency with your package manager and remove any generated outputs you chose to keep. To remove generated icons, a Chrome theme, or a generated Reference, delete the corresponding local output folder. App Stylr does not retain another copy.

For web-host request data or package-provider records, use the privacy controls or request process supplied by Netlify, GitHub, or npm.

## Public-source audit

Repository checks scan the tracked public text, package manifest, packed npm file list, and built Reference for private registry paths, local file URLs, known application metadata, and files outside the documented public allowlists.

No secret values were found in the tracked public tree during the September 10, 2026 audit. This source audit does not replace GitHub secret scanning or a complete history review.

Removing private metadata from the current tree does not remove it from Git history, tags, or remote branches. Any future visibility or history change must repeat the full-ref and public-surface audit before publication.

## Questions and sensitive reports

Use [GitHub Issues](https://github.com/kylbutlr/app-stylr/issues) for general privacy questions that do not contain personal or confidential information. Use [private vulnerability reporting](https://github.com/kylbutlr/app-stylr/security/advisories/new) for a suspected security issue.
