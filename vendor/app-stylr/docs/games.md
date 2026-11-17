# Optional game-interface recipe

The Game Interface profile is a backward-compatible set of values for browser games that want larger controls and compact supporting text around a continuously rendered world. It is an optional recipe, not an App Stylr compatibility requirement or a canonical game layout.

Each game owns its mechanics, information architecture, world rendering, chrome, input model, and responsive composition. New games should adopt this profile only when its values fit their real use scene.

## Profile values

The generated CSS adapter exposes:

```css
--profile-game-minimum-viewport-width: 1024px;
--profile-game-control-height: 48px;
--profile-game-primary-control-height: 58px;
--profile-game-reading-text-size: 14px;
--profile-game-reading-line-height: 21px;
--profile-game-label-text-size: 12px;
--profile-game-label-line-height: 16px;
--profile-game-disclosure-summary-height: 76px;
--profile-game-disclosure-toggle-size: 32px;
```

These values are starting points retained for existing consumers. A game may alias, extend, or ignore them. Changing them locally is not an exception unless the product also changes a shared semantic role or accessibility requirement.

## Shape the interface around play

Start from the immediate player decision and the supported input methods.

- Keep required information and actions reachable without obscuring active play.
- Separate setup choices from controls that matter during the current state.
- Use persistent panels, drawers, sheets, overlays, or document flow only when each pattern fits the available space and interaction.
- Let the game world use product-specific visual language while application chrome keeps semantic meaning clear.
- Preserve legible text, safe-area spacing, reliable close actions, and usable targets at every supported size.

There is no required rail count, panel side, drawer direction, disclosure structure, or desktop-to-mobile transformation.

## Optional disclosure pattern

Progressive disclosure can help when settings are important but not needed every run. Native `details` and `summary` elements are one useful browser baseline, not a required component.

If the product uses disclosures:

- give each summary a clear label and state;
- keep focus visible and the toggle target stable;
- make newly revealed controls discoverable without unexpected scrolling;
- test long content, keyboard behavior, and reduced motion;
- decide whether multiple groups may remain open from the product's task model, not from this recipe.

## Typography and controls

The bundled Geist fonts and profile sizes can provide a coherent starting point. A game may use another type system or larger controls when its world, audience, input method, or platform calls for them.

Whatever values it chooses, the product should keep essential controls readable and operable instead of shrinking them to preserve a particular composition.

## Color and world rendering

Use App Stylr semantic roles when their meanings fit application chrome. The rendered world can use product-specific colors for terrain, teams, vehicles, enemies, danger zones, racing lines, and other mechanics.

Meaningful gameplay color still needs adequate contrast and a non-color cue when color alone would make state ambiguous.

## Completion checklist

- Test every supported input method and viewport class with real game content.
- Verify focus, pause, resume, close, scrolling, and reduced-motion behavior where applicable.
- Verify setup, active play, result, error, and empty states that the game actually has.
- Confirm that chrome does not hide the current decision or trap access to a safe exit.
- Compare the result with the game's product brief and use scene.
- Document only changes to shared App Stylr semantic or compatibility contracts.
