---
name: App Stylr
description: Shared semantic tokens with a charcoal and mint Reference.
colors:
  canvas: "#0E0E10"
  sidebar: "#121214"
  surface: "#151517"
  surface-raised: "#202023"
  border: "#2A2A2E"
  border-strong: "#747479"
  text: "#F5F4F3"
  text-muted: "#A7A7AE"
  accent: "#A9CEC2"
  accent-text: "#111111"
  accent-strong: "#C3E3D9"
  light-canvas: "#F7FAF9"
  light-surface: "#FFFFFF"
  light-text: "#111111"
  light-accent: "#2E3135"
  light-link: "#315E5A"
typography:
  display:
    fontFamily: "Geist Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: "44px"
    letterSpacing: "-0.8px"
  body:
    fontFamily: "Geist Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  metadata:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  control: "8px"
  button: "9px"
  card: "12px"
  dialog: "16px"
spacing:
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "24": "24px"
  "32": "32px"
  "48": "48px"
  "64": "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: App Stylr

## Overview

**Creative North Star: "Charcoal and mint"**

Neutral charcoal surfaces, restrained borders, Geist typography, and mint accents define the shared visual foundation. The Reference presents these roles in compact panels while preserving equivalent meanings in the light theme.

App Stylr apps are dark mode first: dark mode is the default, with an optional light mode toggle implemented by the consuming app.

**Key Characteristics:**

- Semantic surface layers and restrained borders.
- Distinct button, control, and card shapes.
- Shared roles with product-owned composition.

This document captures the v1.2.0 source contract. [Canonical tokens](tokens/app-stylr.json) own all shared values; this frontmatter records a reused subset. Prepared source does not imply a published tag or npm release.

## Colors

Mint remains the dark-theme accent and part of the unchanged brand palette. The dark canvas, sidebar, surfaces, borders, and text use neutral charcoal tones. The light palette retains its pale canvas, white surfaces, charcoal actions, and teal links. Read the complete light/dark semantic pairs and status colors from the canonical tokens.

**The Semantic Equivalence Rule.** Preserve the meaning of each role when switching themes.

## Typography

Geist Sans is the shared heading and body family; Geist Mono distinguishes metadata. The frontmatter records the shared display, body, and metadata roles. The Reference hero deliberately extends the shared scale with its responsive display treatment. Consumers may choose product-specific typography as described in [design practice](docs/design-practice.md).

## Layout

Shared spacing establishes a rhythm, not a page template. The Reference uses a (1280px) maximum width with (24px) side gutters, reduced to (16px) below (480px). Panel padding is (24px), reduced to (20px) below (480px). Hero and section headings become single-column at (800px); specimens have additional responsive rules at (1100px) and (760px). These Reference breakpoints are examples, not shared compatibility requirements.

## Elevation & Depth

The Reference emphasizes tonal layering, bordered panels, and flat card surfaces. Mint glows identify selected status details and focused fields; illustrative device previews retain their own shadow. Do not turn the Reference's elevation choices into mandatory consumer composition.

## Shapes

Buttons have a dedicated button radius. Inputs and compact controls retain control radius, cards retain card radius, and larger dialog forms retain dialog radius. Reference status chips use a local compact corner treatment (6px); it is not a new shared radius token.

## Components

The Reference provides specimens, not a shipped component library. Primary buttons use accent/contrast text; secondary buttons use raised surfaces and strong borders. Inputs use raised surfaces, visible borders, and a focus ring. Sidebar navigation uses selected surface/text roles for its active item. Cards organize related information; status chips pair color with readable labels.

Preserve the Reference's labels, guides, assets, both theme specimens, and focus states. Keep reduced-motion handling. See [reference styles](reference/styles.css) for the complete specimen implementation and [migration guidance](docs/migrations/v1.2.0.md) for the shared contract change.

## Do's and Don'ts

- Do edit shared values in the canonical token file and regenerate adapters.
- Do use semantic roles and preserve light/dark meaning.
- Do preserve Reference labels, guides, and accessible focus states.
- Do treat Reference composition and responsive breakpoints as examples.
- Don't require consuming products to copy the Reference layout.
- Don't replace the unchanged mint brand or light palette when extending the neutral dark surfaces.
- Don't describe prepared source as a published tag or npm release.

## Optional product motion

The [Balanced motion recipe](docs/balanced-motion.md) documents transparent-to-charcoal headers and asset-specific media grading. These are opt-in product patterns, not Reference layout requirements or changes to shared tokens.

The optional icon base uses the approved C / Evening gradient: #0D0D0D at 0%, #3B4145 at 48%, and #899F98 at 100%. It preserves the original broad gradient with slightly darker, less saturated colors, independently of semantic UI tokens. Preserve silhouette, transparent inset, and vector glyph identity; see [platform icon guidance](docs/platform-icons.md).
