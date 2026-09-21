# 2D campaign view

`WoodcutRenderer.js` draws the default canvas map, unit symbols and terrain previews. It is a classic browser script loaded by the root `index.html`; it needs no build step. Shared UI also uses its vector symbols.

Read when changing unit identification or battle status indicators in either view. `WoodcutRenderer.unitPresentation(unit)` supplies the shared glyph, faction colour, health fraction/colour, localized morale, action availability and ordered status badges to 2D tokens and 3D banners. It reads the unit's existing rule methods, including remaining rapid-fire shots and artillery movement restrictions. Health colour changes at 60% and 30%. Routing, fear, low morale, defense, actual elite/veteran traits and wagon formation state stay distinct from health; both maps show up to three status badges with urgent states first. Exact values and explanations use the same inspector and tooltips.

`HexGrid` delegates map drawing to this renderer. Battle input, camera coordination, panels and lifecycle remain shared under `js/ui/`. The supported alternative is [the 3D view](../3d/README.md).

Validate from the repository root with `node scripts/check.js` (includes woodcut and presentation tests).
