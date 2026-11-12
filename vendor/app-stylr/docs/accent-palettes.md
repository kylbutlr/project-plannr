# Accent palettes

Choose an accent palette and a surface tone independently. Sage is App Stylr's original sage/mint default. Accents change accent, accent text/emphasis, link, focus, selection, and informational roles. Surface tones adjust the six neutral roles in both themes. Base brand primitives, success/warning/error meanings, and icons stay consistent.

| Display name | Identifier | Color direction |
| --- | --- | --- |
| Sage | `mint` | Original sage/mint default |
| Ember | `ember` | Warm fire red |
| Slate | `blue` | Muted gray-blue |
| Royal | `royal` | Muted purple |
| Amber | `amber` | Muted champagne gold |
| Monochrome | `monochrome` | Near-black fills in dark mode, near-white fills in light mode |

Display names and descriptions live in `accentPresets` in the canonical JSON. The existing `mint` and `blue` identifiers remain stable even though their Reference labels are now Sage and Slate. The Reference's Colors page shows both dark and light accent swatches and offers palette cards for comparison.

Choose one palette and use its semantic roles together with the shared neutral surfaces. The separate, collapsed Brand reference contains the original Sage primitives for reference, not additional accents to mix into another palette.

Monochrome uses light labels on near-black action fills in dark mode, and dark labels on near-white fills in light mode. Links and focus rings have their own contrasting gray values. Use `accent` with `accentText` for filled actions, `link` for interactive text, and `focus` for focus indicators; an accent fill is not necessarily readable as text on a neutral surface. Choose its surface tone independently.

## Surface tone

| Display name | Identifier | Effect |
| --- | --- | --- |
| Lighter | `lighter` | Lifts canvas, sidebar, surfaces, and borders |
| Normal | `normal` | Retains the original theme values |
| Darker | `darker` | Deepens canvas, sidebar, surfaces, and borders |

These are curated neutral values, not an opacity or brightness filter over the interface. Text, accents, status colors, and icons retain their meaning. Lighter and Darker always describe the direction of surface brightness, in both light and dark mode. The light theme's raised surfaces may remain white in Lighter. `surfaceTones` holds the overlays; `surfaceTonePresets` holds their labels and descriptions. Every accent/tone/theme combination is contrast-validated.

## Web

Import the generated CSS and set the appearance attributes on the product root:

```html
<html lang="en" data-app-stylr-theme="dark" data-app-stylr-accent="royal" data-app-stylr-tone="lighter">
```

Use the identifiers from the tables above. Omitting the accent and tone attributes uses Sage and Normal. Set theme, accent, and tone on the same element; repeat all three attributes for independently themed islands. Change those attributes when implementing a product-owned switcher. App Stylr does not save the selection or add JavaScript to a consuming app.

Use semantic properties such as `--ui-accent`, `--ui-link`, and `--ui-selected` rather than duplicating palette colors. The Reference's Accent palette and Surface tone selectors update the live specimens and record both selections in its URL. JSON and CSS downloads contain all presets.

## Swift

```swift
let defaultTheme = AppStylrTokens.dark
let emberTheme = AppStylrTokens.Accents.Ember.dark
let blueLightTheme = AppStylrTokens.Accents.Blue.light
let customTheme = AppStylrTokens.theme(appearance: .dark, accent: .royal, tone: .lighter)
```

`AppStylrTokens.Accents.Royal`, `.Amber`, and `.Monochrome` provide the additional themes. `AppStylrTokens.Accents.names` maps stable identifiers to display labels; Slate retains the existing `.Blue` type name for source compatibility. The composition method accepts `Appearance`, `Accent`, and `SurfaceTone` enums; it defaults to `.dark`, `.sage`, and `.normal`.

Each accent preset is a complete `AppStylrTokens.Theme` using Normal surfaces. Use the composition method for Lighter or Darker surfaces. A product owns its selection UI and persistence.

## Feedback

Use a neutral `surface` and `border` for quiet messages. Color the text and icon with `success`, `warning`, `danger`, or `info`. Success remains green when the accent is Ember. Pair colors with meaningful text and symbols. The tinted `*Surface` roles remain available when a product needs stronger emphasis.
