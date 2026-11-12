# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use [GitHub private vulnerability reporting](https://github.com/kylbutlr/app-stylr/security/advisories/new) and include the affected version, reproduction steps, impact, and any suggested mitigation.

You should receive an acknowledgement within five business days. A fix timeline depends on severity and whether a coordinated release is required.

## Supported versions

Security fixes target the latest released major version. Older major versions may receive a documentation-only advisory instead of a patch.

App Stylr does not handle authentication, secrets, network requests, or application data. Its higher-risk surfaces are executable Node command-line tools, generated assets, dependency updates, and macOS release validation. Consumers remain responsible for their own application security and platform permissions.
