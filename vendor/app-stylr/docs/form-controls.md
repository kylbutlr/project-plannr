# Native form controls

Import `app-stylr/css`, then `app-stylr/controls.css`, and add `data-app-stylr-controls` to the product root. Supply visible labels and product-owned layout. Inputs and selects use a 44px minimum height, 12px horizontal inset. Enhanced selects keep both outer insets at 12px and use a separate 12px text-to-icon gap; the native fallback retains a 44px end allowance for its chevron. Font size defaults to 16px. A product can set `--control-font-size` for a denser desktop specimen while retaining 16px text on phones.

Light mode follows `data-app-stylr-theme="light"`. Optional compact spacing uses `data-app-stylr-density="compact"`; coarse-pointer devices keep 44px controls. Native options remain keyboard and screen-reader operated. The CSS progressively enhances the picker through `appearance: base-select`; unsupported browsers retain their system menu. Do not promise identical open-option padding across all operating systems. Test closed and open controls, keyboard focus, disabled and invalid states, long values, zoom, and phone layout in the actual consumer.

No JavaScript, storage, network calls, or component framework is included. This is an optional visual recipe, not a shared application component library.

Compact controls use 6px vertical padding and a 40px minimum height on fine-pointer devices. The compact attribute can be on the control root or an ancestor; coarse-pointer devices keep a 44px minimum. Horizontal select insets and chevron clearance remain the same in both densities.

The Reference also demonstrates product-owned density through layout: Compact uses 12px panel padding, tighter form and selection spacing, and smaller row/section gaps. Comfortable retains 24px desktop workspace padding and 20px on phones. Text sizes stay the same. These layout choices belong to the Reference; the optional controls stylesheet does not impose a panel layout on consumers.

See the [platform behavior documented by MDN](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select).
