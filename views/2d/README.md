# 2D campaign view

`WoodcutRenderer.js` draws the default canvas map, unit symbols and terrain previews. It is a classic browser script loaded by the root `index.html`; it needs no build step. Shared UI also uses its vector symbols.

`HexGrid` delegates map drawing to this renderer. Battle input, camera coordination, panels and lifecycle remain shared under `js/ui/`. The supported alternative is [the 3D view](../3d/README.md).

Validate from the repository root with `node scripts/check.js` (includes woodcut and presentation tests).
