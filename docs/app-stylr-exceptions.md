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
