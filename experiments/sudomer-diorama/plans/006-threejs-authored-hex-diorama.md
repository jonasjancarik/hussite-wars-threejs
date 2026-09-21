# Plan 006: Three.js hex battle in an authored miniature landscape

Status: implemented and WebGPU-verified, 2026-09-20. Effort: L. Risk: medium.

Read when replacing the hex renderer, changing its landscape or choosing its rendering effects. This supersedes plan 005's Bevy renderer decision and its claim that visual acceptance is complete. It preserves that experiment's JavaScript rules, AI and parity tests. It does not replace the separate real-time battle in plan 004.

## Intended result

The hex battle should look like the held-still scene at `http://localhost:8082/diorama.html`: a composed miniature with substantial trees, modelled wagons and soldiers, irregular fields, warm light and convincing contact with the ground. The user's second screenshot is the principal visual target. The supplied concept art contributes rural richness, composition, materials and atmosphere. Neither image authorizes changes to the rules or proves historical geography.

Use **procedural-worlds as the primary rendering source**, including its Three.js effects, depth of field, lighting, camera handling and quality controls. Use the Bevy diorama as a visual and layout reference and reuse the existing GLB assets; do not translate the Bevy rendering implementation line by line.

Hexes determine legal positions and actions. They should not determine the outlines of ponds, woods, crop fields or hills. At rest, the scene reads as a landscape; during a turn, restrained overlays make its tactical structure clear.

## Inspected baseline and drift check

The current `/Users/janca/projects/battle-game` directory is not a Git checkout: `git rev-parse --short HEAD` reports `fatal: not a git repository (or any of the parent directories): .git`. Do not invent a commit or initialize Git as part of this port. Reinspect files before implementation; if Git becomes available, record its actual state and preserve unrelated edits.

Planning fingerprints from `shasum -a 256`:

```text
5a5cb56ac83a532d9dea57766632e3cce6549b160067b902e3d134770a356ee7  web/hex-diorama/bridge.js
72b4c03e2f47c811aef620cacea06d5c227e68bfdc8028dd10d4136a7d1213c0  web/hex-diorama/view.js
f041c792f7dadec5090ee3aecca23f5ef3cf86b9bcbd6161d220f6b3f09cb289  src/hex_diorama/board.rs
```

The reusable project resolves to `/Users/janca/projects/procedural-worlds`, inspected HEAD `bada861`; inspect its working changes before copying. Treat that checkout as read-only. Record the source commit, file hashes, required local differences and license notices for transferred code. Do not silently assume its working files equal HEAD.

Current contracts:

- `web/hex-diorama/boot.js` creates `Game(grid, { viewFactory: current => new DioramaBattleView(current) })`, binds the bridge and loads `sudomere_1420`. The game already runs in JavaScript.
- `view.js` publishes visible units, terrain, legal moves and attacks, action availability, effects, results and pause state. Preserve the fixed-pose, illustrative-group treatment.
- `bridge.js` publishes `sudomer-snapshot` events and accepts commands carrying `protocolVersion`, `generation` and `revision`. Its stale-command, busy, AI-turn, pause and visibility checks remain authoritative.
- `panels.js` subscribes to the same snapshots. Camera/grid buttons currently synthesize Bevy keyboard events; replace that coupling with explicit renderer methods.
- `src/hex_diorama/board.rs` uses odd-q centres and a radius of 4, with 20 columns and 12 rows. `height_at()` switches on `terrain_for(coord.col, coord.row)`; water/mud shapes therefore follow discrete cells. Do not port that landscape construction.
- `src/diorama/layout.rs` supplies hand-traced normalized polygons for a 96-by-96 display landscape; `landscape.rs`, `pieces.rs` and `atmosphere.rs` explain the reference composition. Those polygons are useful examples, but its one-pond composition must not overwrite the hex scenario's pond/causeway relationship.
- Existing GLBs and their dimensions are under `assets/models/`; painted ground is `assets/textures/painted-ground.png`. Procedural-worlds vegetation exports are already present under `assets/models/procedural-worlds/`.

Both commands passed during planning:

```sh
node scripts/hex-diorama/test-reference.cjs
node scripts/hex-diorama/test-bridge.cjs
```

The live diorama was visually inspected. No Three.js port, performance result or backend compatibility result is claimed by this plan.

## Rendering reuse

Adapt a small local copy of the required rendering modules first. Avoid a live import from an absolute sibling-project path, and avoid creating a shared cross-project package before this scene works.

Paths below are relative to `/Users/janca/projects/procedural-worlds/web/src/world/`.

| Source | Use in the hex renderer | Adaptation needed |
|---|---|---|
| `tsl-render-pipeline.ts` | Primary scene pipeline: AO, bloom, DoF, grading, aerial perspective and antialiasing | Replace town-specific settings/profiling/capture dependencies with a small battle settings interface; retain required shader dependencies and lifecycle behavior |
| `tsl-photo-bokeh-node.ts` | Existing photographic DoF implementation | Preserve upstream notices and near/far handling; test against soldiers, banners, transparent smoke and shorelines |
| `visual-effects.ts`, `visual-effect-policy.ts`, `tsl-render-stage.ts` | Focus profiles, smoothing, effect ordering and quality policy | Extract relevant functions and their tests, not unrelated legacy atmosphere classes |
| `scene.ts`, `three-environment-presentation.ts`, `seasonal-light.ts` | Hemisphere/key/fill setup, shadow tuning, light color and exposure behavior | Adapt lighting setup into a small module; use one authored daytime preset initially; omit town windows, editor and full day/night simulation |
| `three-camera.ts`, `pointer-gesture.ts` | Camera framing, immediate control reset, drag-versus-click handling | Replace town extent/grid assumptions; implement and test multitouch cancellation for battle orders |
| `static-batching.ts`, `determinism.ts` | Shared geometry/material batching and stable keyed scenery variation | Prefer direct reuse where dependency-free; maintain unit ownership for picking and visibility |
| `three-chimney-smoke.ts`, `tsl-mist-volume.ts` | Smoke implementation and optional atmospheric haze | Adapt emitters to battlefield events; honor pause/restart; tune down or disable costly mist independently |
| `island-mesh-data.ts`, `island-profile.ts` | Reusable modelling techniques for the display base and organic edges | Adapt silhouette/materials to the diorama's soil plinth, not the town island's rocky appearance |

The inspected main `scene.ts` constructs `TslRenderPipeline` for normal WebGPU and WebGL 2 paths. `experimental-render-pipeline.ts` describes the separate development-only pmndrs alternative; it is not the default to copy. Also, `lighting.ts` mainly handles town windows and TV activity; its name alone is not evidence of useful battlefield lighting.

Start from the source project's locked Three.js/TypeScript/Vite versions after verifying the lockfile and dependency health. Its manifest currently declares Three.js `^0.185.1`, TypeScript `6.0.3` and Vite `^8.1.5`; preserve a tested compatible set instead of blindly upgrading. No new frontend framework is needed.

Use the same TSL-capable `WebGPURenderer` approach with **WebGPU as the implementation and verification target**. Retain Three.js's automatic WebGL 2 fallback when it works naturally, but do not spend dedicated implementation or testing effort on WebGL 2 compatibility. Keep a minimal effects-off pipeline available, show a clear error if no renderer backend works, and never silently display an empty canvas.

Official references checked during planning: [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html). Library support is not a measured performance promise.

## Landscape and gameplay agreement

Author a new versioned `sudomer-landscape.json` in world coordinates: terrain control points, pond and mud-basin contours, road/causeway curves, field polygons, woodland masses, clearings and landmark placements. Keep `sudomer-art.json`'s current interpretation available to the Bevy comparison build. Include the scenario revision and a deterministic art seed in the new file.

Build one continuous terrain surface, with relief and material blending sampled from the authored regions. Use separate water surfaces where needed. Banks need sloped ground, shallow margins, reeds and occasional stones; avoid a flat blue polygon next to a vertical tile cliff. The drained basin needs channels, wet/dry variation and sparse reeds, not a uniformly brown slab. Fields are irregular strips with their own orientation, stubble and worn edges; paths curve through the composition rather than running as a uniform strip across the whole board.

Keep the source scenario's terrain categories, movement costs, passability, positions, adjacency and reinforcement routes unchanged. The rendered surface and the rules map are distinct data, with explicit agreement checks:

- Every playable cell has one anchor that maps back to its original coordinate. Its complete formation footprint must fit on suitable ground without overlapping neighbouring formations.
- Water-cell anchors remain visibly water; mud anchors remain visibly mud; causeway anchors remain on the usable crossing. Reshaping shorelines cannot visually close the passage or suggest a new playable crossing.
- Use modest coastline freedom near cell margins, with shallow transitions. If matching the desired silhouette requires moving terrain classes or units, report that separately as a scenario change; do not disguise it as artwork.
- Decorative woods and village groups can span multiple cells. Do not introduce a visually impassable forest or wall across an open movement route. Reserve clear space around playable anchors and movement corridors, placing dense woodland mainly in scenic margins and appropriate clearings.
- Raycast the actual terrain and water, map the world X/Z hit to odd-q coordinates, and reject off-board hits. Pick units through explicit hit targets tied to visible unit IDs. Decorative meshes never intercept orders.
- The full grid is off initially. Show a fine hover outline, selected-cell cue and restrained legal destination/target marks when needed; provide an explicit grid toggle. Drape overlays over the terrain without gaps or z-fighting. Do not put every formation on a large colored hex pedestal.

Prioritize large compositional decisions over noise: tree masses framing the battle, clear open ground, a distinct church/village silhouette, readable wagon groups and a closer default camera. Match the miniature proportions of screenshot two. Enlarge visual presence through composition and coherent model scale, not oversized soldiers protruding into adjacent cells.

Reuse the existing infantry, horse, wagon and building GLBs first. Figures stay in fixed poses, with whole groups translating and turning for orders. Trees should vary in height, rotation and olive/gold palette within intentional clusters. The original concept art (`ChatGPT Image Sep 19, 2026, 10_29_07 PM.png`) and `assets/diorama/landscape-plan.png` are composition references, not textures to project onto the ground.

## Lighting and focus

Begin with the procedural-worlds hemisphere, warm key/fill lighting, filtered shadows, tone mapping and atmospheric grade. Tune their intensities against this kit; do not copy numeric settings without checking materials and scale. Preserve small contact shadows beneath figures, wagons and trees; avoid the uniform brown haze of screenshot one.

Bring across the existing miniature DoF, including focus smoothing and its quality modes. During play, keep the selected formation and relevant nearby destinations readable with broad, gentle focus; soften distant scenery rather than blurring the tactical area. Reduce focus strength during camera movement, restore it smoothly, and never tie it to rapidly changing hover snapshots. HTML controls remain sharp. A stronger scenic view can reuse the same pipeline, but is optional and not a requirement for the first port.

Maintain a low-quality option with DoF/AO/mist disabled and reduced pixel ratio/shadow resolution. Judge composition with effects disabled too: blur must not conceal weak terrain or model placement. Invalidate cached shadows after unit movement, reinforcement arrival, visibility changes, resets or lighting changes.

## Implementation sequence

### 1. Establish the Three.js scene and a representative art sample

Create an isolated TypeScript/Vite package under `web/hex-three/`, using npm and a lockfile (there is currently no JS package manager in battle-game; this introduces tooling only for the Three.js view). Add `typecheck`, `test` and `build` scripts. Keep renderer modules small: `render-pipeline`, `lighting`, `camera`, `assets`, `terrain`, `scenery`, `units`, `picking`, `overlays`, `effects`, `snapshot-client` and pure `hex-coordinates` helpers.

Adapt the procedural-worlds pipeline and necessary dependency closure with provenance. Build a representative part of the actual Sudoměř layout: pond margin, drained-bank transition, causeway, dense woodland, one wagon group and one infantry/cavalry group. Use the real GLBs and transferred lighting/DoF immediately. Do not spend the first milestone recreating the flat existing hex board.

**Gate:** `npm --prefix web/hex-three run typecheck`, `npm --prefix web/hex-three test`, and `npm --prefix web/hex-three run build` exit 0. These are new commands to implement, not commands claimed to exist today. Capture a fixed overview and close view with effects on/off on WebGPU. Inspect against screenshot two for model scale, tree mass, grounding and material color. Record remaining visual differences before extending the scene; passing tests alone is not visual acceptance. WebGL 2 fallback is not a separate acceptance gate.

### 2. Complete authored terrain and map agreement

Add the full new landscape JSON and scene population. Use independent keyed cosmetic randomness; never consume the game's RNG. Port the odd-q coordinate contract, not the Bevy tile terrain. Add `tests/terrain.test.ts` and `tests/hex-coordinates.test.ts` in the new package: all 240 anchors round-trip, even/odd neighbour cases, shared-edge tie policy, off-board rejection, terrain-class/anchor agreement, causeway connectivity and model footprint clearance. Use actual transformed asset bounds, including multi-figure formations.

**Gate:** package tests and build pass. A diagnostic overlay makes mismatched anchors and obstructed corridors visible and reports zero violations. Overview, shore close-up and village/woodland captures show no repeated hex-shaped geography. The tactical corridor remains readable with the grid hidden.

### 3. Connect existing game and controls

Keep the pinned vendor tree unchanged. Retain `boot.js`, `view.js`, `bridge.js` and HTML panels, changing only integration needs. Subscribe to snapshots before starting the game; apply an initial snapshot even if asset loading finishes later. Retain protocol/generation/revision checks; do not call game internals from the renderer. Use a single snapshot consumer that distributes updates rather than competing readers of `takeSnapshot()`.

Maintain unit roots by ID, updating transforms and status without rebuilding scenery on each UI publication. Use explicit `frameScene()` and `setGridVisible()` methods for panels. Preserve all current actions, inspection/damage previews, AI turns, pause, restart and result handling. Cosmetic movement never delays rules completion, hides authoritative state, or accepts input against an obsolete displayed position. Snap to the current authoritative position when interrupted.

Deduplicate cosmetic events across snapshots and clear them per generation. Ignore stale GLB-load completions and old game callbacks after restart/disposal. Existing event IDs use the retained-array length, so test more than 48 effects; if IDs repeat, fix the adapter's cosmetic counter with a regression test without altering vendor rules. Use only visible snapshot units/events, even if fog is currently disabled by default.

**Gate:** both existing Node parity/bridge commands pass. New `tests/snapshot-client.test.ts` covers late initialization, repeated revisions, changed generations, more than 48 effects, hidden units, pause and repeated restart. Browser interaction checks cover click/tap, orbit, pinch/pan, pointer cancellation, HUD clicks and resize: camera gestures never issue game orders. A complete game reaches a genuine result and restarts successfully.

### 4. Package and verify before switching the default

Introduce `scripts/build_sudomer_hex_three.sh`, building the new package into an isolated staging directory and copying only owned outputs into `web/dist`. Do not run a build that empties the shared dist directory. Initially expose `sudomer-hex-three.html` beside the existing page; after visual and gameplay gates pass, make `sudomer-hex.html` use Three.js. Retain the Bevy source/build and provide a separately named comparison page so its build cannot silently overwrite the new default. Preserve all other browser scenes and packaged files.

Keep assets and imports relative and self-contained, with no CDN, sibling checkout or Rust/WASM requirement for the Three.js hex build. Hash application, adapter and asset inputs for cache invalidation. Update the root README, hex README and relevant build-script descriptions when the default changes; record screenshots and measured results in `design-qa.md`.

**Gate:** `SUDOMER_HEX_DIST_DIR=/tmp/sudomer-hex-three-check ./scripts/build_sudomer_hex_three.sh` creates a standalone working package. Run the existing Node tests plus package typecheck/tests/build. Browser network inspection shows no missing assets or Bevy WASM fetch for the new page. Compare hashes of unrelated dist files before/after packaging; they must be unchanged. The retained Bevy comparison route still works after rebuilding it.

Measure a 60-second orbit/selection/AI-turn sequence after warmup at 1440×900 and a 390×844 viewport, recording device/browser, backend, pixel ratio, frame-time median/p95, draw calls and memory counts. Aim for 60 fps on the development desktop and 30 fps on a real mobile device with reduced effects; these are targets, not current claims. Test ten restarts for accumulating scenes, listeners, frame loops or GPU resources. If no mobile device is available, report that gap instead of treating an emulated viewport as mobile performance proof.

Use the integrated browser for visual checks and scripted browser tests only where reproducibility warrants them. Reuse the existing server if it serves the required output. If starting a persistent server, bind to `0.0.0.0`, register/annotate it in PortPilot and report verified loopback, LAN and Tailscale URLs. Do not stop the pre-existing port-8082 server.

## Scope and completion

Implementation may change `web/hex-three/**`, `web/hex-diorama/{boot,view,bridge,panels}.js`, new landscape data, hex page/CSS, hex build scripts and tests, and matching documentation. Reuse current GLBs without regenerating the whole Blender kit. Existing Rust scenes and the procedural-worlds checkout remain untouched. Defer native renderer migration, generalized world editing, new mechanics, historical/GIS remapping, a shared-engine package and new figure animations.

Completion requires all four gates, genuine gameplay parity, a standalone package, WebGPU/effects verification, and the authored appearance in both overview and close-up. Document subjective visual judgment separately from automated checks. If effects cannot transfer without importing the town/editor wholesale, implement a narrow local adapter and report the omitted feature; do not expand into a cross-project refactor. If terrain artistry requires a rules change, pause that part and present the concrete conflict. Do not push or publish anything without separate authorization.

Implementation verification covered the new package typecheck, ten focused unit tests, the two retained JavaScript parity/bridge suites, a standalone `/tmp` package, unrelated-output hash comparison, the retained Bevy comparison page, live WebGPU overview/close/effects-off checks, responsive layout, controls, selection, pause/resume, a genuine AI turn and restart. The final 1440×900 60-second WebGPU sample is recorded in `design-qa.md`. No real mobile device or dedicated WebGL 2 pass was available; neither is claimed.
