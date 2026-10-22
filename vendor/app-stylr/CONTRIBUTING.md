# Contributing to App Stylr

Thanks for helping improve App Stylr. Contributions should make the small public interface more useful without turning the project into a general component framework.

## Before opening a change

- Open an issue for a new token family, adapter, platform, or command so the interface and compatibility impact can be discussed first.
- Keep application-specific behavior and private product governance out of this repository.
- Add a new adapter only when a real consumer needs it.
- Treat `tokens/app-stylr.json` as canonical. Never edit generated CSS, Swift, icon, or Chrome-theme files by hand.

## Development

Requires Node.js 20 or newer. Swift adapter changes also require a Swift 5.9-compatible toolchain.

```sh
npm ci
npm run build
npm test
npm run package:check
swift build
```

When the visual contract changes, inspect both local reference pages at desktop and phone widths. Update the changelog and add migration guidance for any public interface change.

## Pull requests

Describe the public behavior that changed, the compatibility impact, generated files refreshed, and the checks you ran. Keep unrelated formatting or application-specific policy out of the same pull request.

By contributing, you agree that your contribution is licensed under the project’s [MIT License](./LICENSE).
