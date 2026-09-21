# Diorama landscape experiment

Generated with the built-in image-generation tool on 2026-09-20. The exact generation prompt is retained in `image-prompt.txt`; `landscape-plan.png` is the unmodified generated output.

This is an imagined early-15th-century South Bohemian landscape study. It is not a historical map, a reconstruction of Sudoměř, or a derivative of the ČÚZK elevation fixture. No historical accuracy was established by generating the image.

The image is used as a composition reference, not as a ground decal. `src/diorama/layout.rs` contains manually traced normalized image coordinates for woodland polygons, strip fields, a pond, and the winding track. The top-left image corner is `(0,0)` and the bottom-right is `(1,1)`. These map onto a 96-by-96 scene-unit tile; they are not georeferenced meters. The village placement follows the image. Elevation, forces, display plinth, and atmosphere are separately art-directed.

The region definitions drive terrain colors, crop surfaces, tree and hedge placement, stubble, and reeds. Deterministic seeds keep the scene reproducible. Trees, buildings, wagons, horses, and soldiers reuse the existing Blender kit. Ground pigment reuses `assets/textures/painted-ground.png`; see that folder's provenance note.

The main scene at `/` adds formation movement, terrain orders, animated cavalry, and dust that follows the moving horses. The separate `/diorama.html` view keeps the figures and horses fixed while its smoke, dust, and haze drift. Soft alpha-textured billboards supply those effects in both views. Distance fog, filtered directional shadows, bloom, tone mapping, and FXAA run on the existing WebGL 2 path. This is an approximation of atmospheric scattering, not a volumetric-lighting simulation.

Open `/` for the playable battlefield, or run `cargo run --release --bin hussite-battlefield-poc`. Click or tap the terrain to redirect the attacking formations. Right-drag orbits, middle-drag pans, and scrolling zooms; F restores framing, Space pauses the battle and atmosphere together, R clears orders and restarts the original advance, P saves a screenshot, and H hides the browser overlay.

Open `/diorama.html` for the held-still view, or run `cargo run --release --bin diorama`. Its camera controls are the same, while Space pauses only atmosphere and R resets it. `Landscape plan` opens the generated reference in both browser views.

Touch controls: a short tap gives an order in the playable view; a one-finger drag orbits; two fingers pan and pinch to zoom. Gesture tracking rebases when fingers are added, lifted, or canceled, and camera gestures do not issue orders. The canvas suppresses browser scrolling/zoom gestures, while the plan dialog remains scrollable. On-screen buttons provide framing, pause/resume, and playable-scene reset without a keyboard.

For browser regression checks, run `node scripts/test_diorama_touch.cjs` with Playwright available on Node's module path and the local server running. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an existing Chromium binary; `DIORAMA_URL` overrides the local test URL. Set `BATTLE_PLAYABLE=1` when checking `/`; without it, the script checks the static view. The disposable mobile browser checks actual rendered gesture changes, pause, frame restoration, and the plan dialog, plus terrain orders, resumed movement, and reset in playable mode.
