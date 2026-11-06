# Mandatory and optional conventions

## Mandatory when claiming App Stylr compatibility

- Pin one released App Stylr version.
- Use semantic theme roles rather than raw brand colors for application chrome.
- Start apps in dark mode by default. A light mode toggle is optional.
- Keep semantic meanings equivalent when exposing both light and dark themes.
- Treat generated adapters as read-only outputs.
- Preserve at least 4.5:1 contrast for normal text and 3:1 for large text and meaningful graphics.
- Pair status color with text, shape, or another non-color signal.
- Respect reduced-motion preferences when using motion tokens.

These rules keep shared meanings stable across adapters and make an App Stylr version meaningful. They do not define page composition.

## Optional recommendations

- Offer a light mode toggle when useful to the product. Keep dark mode as the default and implement the toggle in the consuming app.
- Use bundled Geist Sans and Geist Mono when they suit the product voice.
- Use the [web text-wrapping default](#web-text-wrapping) to reduce awkwardly short final lines, with stable wrapping for editable text.
- Use the provided spacing, radius, size, and motion scales as coordinated starting points.
- Keep Sage as the original default accent, with optional [accent palettes](./accent-palettes.md).
- Use quiet neutral feedback surfaces with semantic colors on text and icons.
- Build product icons from the flat charcoal base with a light identifying glyph, reviewing 16px first.
- Adopt the Game Interface profile for canvas-first browser games.
- Use the generated Chrome theme or Sparkle release checker.

Applications own their components, layouts, breakpoints, density, navigation, naming, authentication, deployment, and release automation. Product requirements and native platform conventions take priority over optional recommendations.

The [design-practice guide](./design-practice.md) explains how to preserve shared character without copying a canonical layout.

## Web text wrapping

For web apps, browser-extension interfaces, and game UI rendered as HTML, use `text-wrap-style: pretty` on `body` as an optional default. The property inherits, so individual components can override it. Apply it in the product stylesheet; the generated token adapter does not set global element styles.

```css
body {
  text-wrap-style: pretty;
}

textarea,
[contenteditable=""],
[contenteditable="true"],
[contenteditable="plaintext-only"] {
  text-wrap-style: stable;
}
```

The longhand changes the wrapping algorithm without resetting the wrap/nowrap mode. Keep `stable` on editable text so earlier lines do not rearrange as users type. Also consider a scoped `stable` override for text that repeatedly reflows during animation or frequent updates. Use `balance` only on headings or captions where roughly equal line lengths suit the product's design.

`pretty` is a browser-controlled improvement, not a guarantee of two words on the final line or identical breaks across browsers. Unsupported declarations fall back to existing wrapping. It does not style text drawn into a canvas or native text views.

Before adopting the default, check real headings, body copy, compact or clamped components, editing, and print output at supported viewport sizes and in supported browsers. Assess performance for unusually long unbroken text blocks or frequently reflowing text. Normal paragraphs are suitable for the default; product requirements may override it.

See the [CSS wrapping specification](https://drafts.csswg.org/css-text-4/#text-wrap-style) and [WebKit's typography and performance guidance](https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/).
