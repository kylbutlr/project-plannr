# Balanced motion and dark media

This optional composition recipe pairs App Stylr's charcoal surfaces with restrained mint detail. It records the approved Portfolio treatment without making a sticky header, background video, or animation mandatory for other products. Shared semantic colors and generated adapters remain unchanged.

## Transparent-to-charcoal headers

Keep the header transparent at the top of every page that uses this pattern. On scroll, reveal a separate charcoal layer rather than moving or resizing navigation. Reverse the reveal on return to the top. The product owns scroll detection and toggles `is-scrolled`; synchronize it after navigation, history restoration, and initial load.

The surface fades in over 320ms and settles downward from 6px above its resting position over 420ms. A subtle mint-tinted divider fades in over 240ms and expands from 82% width over 480ms. Use the existing active-link treatment independently.

```css
.balanced-header {
  position: sticky;
  top: 0;
  z-index: 50;
  isolation: isolate;
  background: transparent;
  color: var(--ui-text);
}
.balanced-header::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--ui-sidebar);
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
  opacity: 0;
  transform: translateY(-6px);
  transition: opacity 320ms cubic-bezier(.22, 1, .36, 1),
              transform 420ms cubic-bezier(.22, 1, .36, 1);
}
.balanced-header::after {
  content: "";
  position: absolute;
  inset: auto 0 -1px;
  height: 1px;
  pointer-events: none;
  background: linear-gradient(90deg, var(--ui-border),
    color-mix(in srgb, var(--ui-accent) 28%, var(--ui-border)) 50%,
    var(--ui-border));
  opacity: 0;
  transform: scaleX(.82);
  transition: opacity 240ms ease,
              transform 480ms cubic-bezier(.22, 1, .36, 1);
}
.balanced-header.is-scrolled::before,
.balanced-header.is-scrolled::after {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .balanced-header::before,
  .balanced-header::after {
    transition: none;
    transform: none;
  }
}
```

Keep header height consistent between states at each breakpoint. Layered backgrounds must not block pointer input or hide focus outlines. Text and navigation need sufficient contrast over both the page content and the solid surface. The decorative divider is not a control boundary or the only indication of an active link.

## Darker background media

When a mint-tinted video competes with a neutral charcoal interface, adjust the decorative media layer rather than changing accent tokens or filtering the whole hero. Portfolio uses `opacity: .55` and `filter: saturate(.45) brightness(.85)` on the wrapper containing its existing video and poster, with a separate dark overlay behind the text.

These values are specific to that asset, not a universal media preset. Inspect the brightest frames and the poster on real desktop and phone layouts. Preserve a visible pause control, a poster fallback, and a reduced-motion path that avoids loading the video. Never apply the media filter to text, controls, logos, or focus indicators.

## Adoption checks

- Confirm the header is transparent at the top, opaque when scrolled, and transparent again on return.
- Check direct page loads, inner-page navigation, and restored scroll positions.
- Confirm no header-height jump, horizontal overflow, hidden links, or blocked pointer targets.
- Check reduced motion, keyboard focus, video pause, and poster fallback.
- Judge contrast against actual media frames, not only the base canvas color.

See [design practice](design-practice.md) for shared and product-owned responsibilities, and [the v1.2 migration guide](migrations/v1.2.0.md) for the charcoal and mint token update.
