# Design practice

App Stylr creates recognizable product character without prescribing a page layout, component tree, or interaction model. Treat the package as shared visual infrastructure. Let the product brief, user task, content, and platform determine the composition.

## What stays shared

App Stylr owns the parts that benefit from a stable contract:

- semantic color roles and equivalent theme meanings;
- accessible contrast and non-color communication;
- generated CSS and Swift adapters;
- coordinated type, spacing, radius, size, and motion scales;
- reusable assets and deterministic generation tools;
- versioning and upgrade expectations.

These are compatibility concerns. They should remain reviewable across products and releases.

## What each product owns

Each product decides its own:

- information architecture and navigation;
- layout, breakpoints, density, and responsive transformations;
- components and interaction patterns;
- initial theme and whether users can change it;
- typography choices beyond the bundled starting point;
- imagery, illustration, product icons, and expressive motion;
- platform-specific behavior and native controls.

These choices do not need an App Stylr exception unless they replace or change a shared semantic contract.

## Start from the use scene

Choose a surface posture before choosing a layout:

- **Persuade:** help a visitor understand value and decide what to do next.
- **Operate:** help a user complete a task with clear states and efficient controls.
- **Read:** help a reader understand structured guidance or long-form content.
- **Experience:** let the work, artifact, or world remain visually primary.

A product can use more than one posture across its surfaces. A marketing page and its settings screen should not inherit the same composition merely because they share tokens.

## Use tokens as raw material

Prefer semantic roles for shared meaning, then alias them into product vocabulary when that improves clarity.

```css
:root {
  --editor-canvas: var(--ui-canvas);
  --editor-selection: var(--ui-selected);
  --editor-selection-text: var(--ui-selected-text);
}
```

Use the supplied spacing, radius, size, and motion values where they fit. A product may extend those scales or introduce local values when the task, platform, or content needs something different. Avoid replacing shared semantic meanings with raw palette colors.

## Read the Reference as evidence

The public Reference demonstrates token behavior, contrast, typography, states, and responsive possibilities. Its specimens are examples, not templates. Do not copy its dashboard, card, panel, or breakpoint composition as a compatibility requirement.

When reviewing a product, compare the result with its own brief and real use scene. Use the Reference to confirm that shared roles remain coherent, not to judge whether two products share the same screenshot.

## Review outcomes, not resemblance

Before shipping, verify that:

- the primary task and next action are easy to understand;
- hierarchy survives real content and supported viewport sizes;
- focus, hover, disabled, loading, empty, success, warning, and error states work where applicable;
- light and dark roles remain equivalent when both themes are offered;
- motion respects reduced-motion preferences;
- important meaning does not rely on color alone;
- deliberate changes to shared semantic roles are documented for the next upgrade.

## Optional Balanced motion recipe

The [Balanced motion and dark media recipe](balanced-motion.md) shows a transparent-to-charcoal header reveal with stable navigation and a restrained media treatment. It is product-owned composition guidance, not a new shared token requirement.
