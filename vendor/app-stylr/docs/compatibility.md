# Compatibility and upgrades

## Supported environments

- Node.js 20 or newer for package commands and repository tooling.
- CSS custom properties, `@font-face`, and stylesheet imports in the consuming web build.
- Manifest V3 extension pages and Shadow DOM injected interfaces.
- Swift tools 5.9 or newer, with macOS 10.15, iOS 13, tvOS 13, or watchOS 6 as declared floors.

Frameworks are not part of the compatibility contract. React, Vue, Svelte, plain HTML, and other systems can consume the CSS adapter if their build resolves package CSS imports.

## Upgrade expectations

1. Pin a semantic version or immutable Git tag.
2. Read the changelog and matching migration note.
3. Update package and manifest pins together.
4. Refresh any copied templates or vendored generated files deliberately.
5. Run the consumer’s tests and build.
6. Inspect affected themes, responsive states, focus, errors, and reduced-motion behavior that the product actually supports.
7. Record intentional changes to shared semantic or compatibility contracts. Product-owned layouts do not need exceptions.

Patch and minor releases do not remove existing public tokens or exports. A major release may remove or rename them and must include a migration note.
