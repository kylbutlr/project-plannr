# Mandatory and optional conventions

## Mandatory when claiming App Stylr compatibility

- Pin one released App Stylr version.
- Use semantic theme roles rather than raw brand colors for application chrome.
- Keep semantic meanings equivalent when exposing both light and dark themes.
- Treat generated adapters as read-only outputs.
- Preserve at least 4.5:1 contrast for normal text and 3:1 for large text and meaningful graphics.
- Pair status color with text, shape, or another non-color signal.
- Respect reduced-motion preferences when using motion tokens.

These rules keep shared meanings stable across adapters and make an App Stylr version meaningful. They do not define page composition.

## Optional recommendations

- Choose the initial theme from the product's use scene. The generated CSS falls back to dark values only as an implementation default.
- Use bundled Geist Sans and Geist Mono when they suit the product voice.
- Use the provided spacing, radius, size, and motion scales as coordinated starting points.
- Build product icons from the charcoal-to-mint base.
- Adopt the Game Interface profile for canvas-first browser games.
- Use the generated Chrome theme or Sparkle release checker.

Applications own their components, layouts, breakpoints, density, navigation, naming, authentication, deployment, and release automation. Product requirements and native platform conventions take priority over optional recommendations.

The [design-practice guide](./design-practice.md) explains how to preserve shared character without copying a canonical layout.
