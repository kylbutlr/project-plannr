# App Stylr scope

Project Plannr preserves the approved board layout with three named views and
responsive project controls. App Stylr supplies tokens and fonts, not the app's
layout or ticketing behavior. No adapters have been changed during extraction.

The private access panel uses the existing surface, spacing, type, accent and
control roles. No App Stylr adapters were modified. The explicit disposable demo
does not show sign-in controls. Public deployment stays blocked until live
authentication, database persistence, and the hosting adapter are verified.

The Impeccable detector could not resolve the server-mapped `/tokens.css` file.
Its cramped-padding warnings therefore miss token values; rendered access-panel
padding was inspected and is 24 px. Geist is retained intentionally because it
is the approved App Stylr font, despite the detector's generic font warning.
PRODUCT.md uses the earlier product-context format. Migrating that metadata to
the newer Impeccable schema remains optional and was not mixed into this setup.

The owner-approved ticket editor replaces the width-consuming sidebar with a
native dialog, full-screen on mobile. It retains the same App Stylr tokens,
Geist font, focus treatment, and mint Save action. Form spacing is 16 px and
desktop body padding is 24 px. The board retains its full width behind the
dialog. Agent reservations and technical revision metadata are not primary
owner controls. No vendored adapter files were modified.

The product favicon preserves the pinned Evening base, its transparent inset and
corner radius, with a product-owned three-column planning glyph. It is a
self-contained square SVG with deterministic 16px/32px PNG fallbacks generated
by the unmodified pinned App Stylr exporter. All three assets are whitelisted
for local serving and Netlify publication. No PWA or installation behavior was added.

## Public interface refresh

The product retains its charcoal/mint identity and uses a local candidate of the optional shared controls recipe from the App Stylr v1.3.0 refresh. Workspace labels, density, default views and storage behavior remain product-owned. Browser-local display names never alter server authentication or audit identity. Fresh visual review remains pending browser authority.

## App Stylr v1.4.1 visual refresh

The shared adapters and Geist assets come from immutable source 6fbc524f07ed7aa7db9c8593bf8116b9440937bc. Sage/dark/Normal and Comfortable remain the defaults, with existing product preferences preserved. Shared geometry uses 4px controls/buttons, 8px cards and 12px dialogs. Feedback stays on neutral surfaces with semantic text/icons. Existing foreground glyphs use the palette-independent Graphite base, with scalable SVG masters and directly rendered high-resolution exports. Keep the incumbent layout, keyboard behavior, auth, data, integrations and platform-specific controls intact.
