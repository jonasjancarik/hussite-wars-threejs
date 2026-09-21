# Plan 005: Play Sudoměř as a 3D hex diorama

`read_when`: implementing the alternative turn-based prototype, its reference-game adapter, or authored hex scenery.

Status: IMPLEMENTED 20 September 2026. The standalone browser prototype, authored concept-art/diorama presentation, expanded differential rules tests, packaged build, design QA and browser verification are complete. The final 30-second sample passes both frame-time targets; evidence is in `benchmark-results/sudomer-hex/verification.md` and `design-qa.md`.

## Executor instructions

Work in `/Users/janca/projects/battle-game`. Read the whole plan, inspect current files, then implement milestones sequentially. This is a separate playable experiment from plan 004's full-scale RTS. Do not replace, stop, or rewrite that work. Keep progress and evidence in this plan's checklist; incomplete milestones must remain labelled incomplete.

Build on the existing Bevy diorama's models, painted terrain palette, soil-edged display plinth, warm lighting, camera and smoke/dust treatment. Do not simply put the reference's 2D canvas on a plane. The terrain and pieces must be real 3D geometry, picked through the 3D camera.

**Architecture decision:** use the friend's existing JavaScript battle engine for rules and AI, with a new presentation adapter and a Bevy WASM renderer. The first playable deliverable is browser-only. Native Rust can render fixture snapshots for visual iteration and run geometry/serialization tests, but must not pretend to run the JavaScript game. Do not port combat to Rust, install another 3D engine, or duplicate the rule engine. Reusing the engine gives us a useful gameplay parity target while we evaluate the 3D presentation.

**Visual decision:** static figurines at every distance. A whole unit group may slide/turn between tile centres, but no walking, horse gait, skeletal animation or attack/death poses in motion. Smoke and dust may animate as cosmetic effects. Pause freezes these effects and presentation transitions; reset cancels them. Unit figures are illustrative group markers, not individual simulated people.

The user considered Three.js and reuse from `~/procedural-worlds`, then chose to stay with Bevy for now. Do not migrate renderers or import that project's runtime. Existing assets already present here may be reused; leave `/Users/janca/projects/procedural-worlds` unchanged. The snapshot/command interface leaves a later renderer experiment possible without requiring a generalized renderer framework now.

## Outcome and limits

A player opens `/sudomer-hex.html`, sees a small authored Sudoměř board, selects a unit, reads its legal moves/attacks, deploys wagons, issues orders and ends the turn. The opponent takes its turns using the source AI. Reinforcements, round limits, morale and results follow the source engine. A complete battle can be played and restarted without reloading the page.

Only Sudoměř and its source mechanics are required. No campaign shell, encyclopedia, account, remote service, save/load UI, map editor, full historical troop counts, accurate geographic distances, generalized procedural terrain, second battle, multiplayer or native rule port. Scenario-relative numbers remain unit counts/health; no fabricated conversion to men.

## Current sources and drift

The workspace had no Git repository at initial inspection. Check again, preserve unrelated changes and do not initialize Git or switch branches. A Sol task is already implementing plan 004 in this same directory; treat `src/battle/`, `src/bin/sudomer_battle.rs`, its assets, page, build script and evidence as owned by that task. They are not prerequisites for this plan.

Reference clone: `/Users/janca/oss/husitske-valky`, main at `dbdf61907212476cda816ff2036a9a8d41bf3572`. Verify this SHA. If it changes, compare Sudoměř data and adapter interfaces before proceeding; pin one exact revision for the prototype. Do not modify that clone or fetch newer rules halfway through implementation.

Key reference files:

- `js/core/game.js:4`: `constructor(hexGrid, { viewFactory = game => new BattleView(game) } = {})`. Instantiates rule systems, then constructs `this.view = viewFactory(this)`. This is the intended integration seam.
- `scripts/helpers/test-battle-view.js`: complete small example of the view contract, including `animateMove() -> Promise`, notifications, selection, results, pause and cleanup. It is a contract reference, not a production view to ship unchanged.
- `scripts/helpers/game-harness.js`: dependency load order and headless execution of the real classes using Node's built-in `vm`; its `newGame` constructs `HexGrid`, `Game`, then `initGameWithScenario`.
- `docs/CODE_STRUCTURE.md`: rules/view split and known residual DOM, audio, storage and localization dependencies. Read its limitations; the rules are not a standalone package.
- `js/core/hex.js`: grid geometry, occupancy and neighbor order. It constructs a `WoodcutRenderer` and requests a Canvas 2D context even if a different battle view is injected.
- `js/data/scenarios.js:399`: `sudomere_1420`, the authoritative 20 × 12 board and deployment. Use the current executable data, not older design documents.
- `js/data/unitTypes.js`, `js/entities/Unit.js`, `UnitFactory.js`: actual stats and combat unit behavior.
- `js/systems/CombatSystem.js`, `BattleActionSystem.js`, `ScenarioEventSystem.js`, `VictoryConditionsSystem.js`, `MoraleSystem.js`, `FogOfWarSystem.js`, plus `js/ai.js`: rules to retain.
- `Game.getValidMoves`, `canMoveTo`, `handleHexClick`, `endTurn`, `undoLastMove`, `activateChoral`, `toggleWagonFormation`, `toggleWagonFormationLine`, `toggleWagonMarch`, `getWagonMarchTargets`, `marchWagonLine`: inspect actual action entry points and permission checks before exposing controls.

The source currently specifies three open wagon units, 13 Hussite units total, 15 enemy units initially and three enemy reinforcements at turn 6. Its 12-round survival objective and alternative field-army elimination are source rules, not plan 004's rules. Verify these counts by executing the pinned scenario rather than maintaining hand-transcribed arrays. Terrain is 40 water hexes, 40 mud hexes, two dam hexes and plains elsewhere; named pond labels are also data. Source movement cost currently adds one point for cavalry entering mud/swamp/forest; reproduce through the source API, not a second formula.

Local visual references:

- `src/diorama/mod.rs`: `DioramaPlugin`, orbit camera, `Exposure { ev100: 11.3 }`, TonyMcMapface tonemapping, bloom, fog and warm directional light.
- `src/diorama/landscape.rs`: painted-ground material, pond surface, exposed soil sides, display plinth, small farm/woodland dressing.
- `src/diorama/pieces.rs`: static wagons, infantry, cavalry and circular figure bases. The `BattleMode(false)` path does not attach the cavalry walking animation.
- `src/diorama/atmosphere.rs`: soft billboard smoke/dust. Its positions refer to the old layout; adapt effects to hex unit positions, do not reuse those coordinates.
- `assets/models/`: wagon with two decorative crew, three infantry types, cavalry, banner, trees, church and farmhouse. Embedded wagon crews are acceptable here because figures are unit illustrations, not headcount records.
- `web/diorama.html`, `src/bin/diorama.rs`, `src/diorama/app.rs`: existing visual baseline and launch flow.
- `Cargo.toml`: Rust 1.95.0, Bevy 0.19.1. At latest inspection WASM-specific `wasm-bindgen = "0.2"` and `web-sys` are already present from concurrent work; do not overwrite those additions.

Inspected SHA-256 values (re-read compatible drift, never revert it):

```text
8938f8219167ca869c65f97f1c0cb032b05be2d5cc90a02e4c840c3be02390d2  src/diorama/mod.rs
10ebb5ca8fa76d410b1685885d28daef7d0f789da289a6a40c83047315e6d445  src/diorama/landscape.rs
74535ddc1962af77354e5059fc0dfe9214d8d5c79542d60266aef710e4935e9e  src/diorama/pieces.rs
aa6bf3ae9649f7477f2d5138f317fc48a0180490a286e16ca509cb2f21048c17  src/diorama/atmosphere.rs
```

## Files and ownership

Create `src/bin/sudomer_hex.rs`, `src/hex_diorama/{mod,board,pieces,camera,input,bridge,effects}.rs`, `web/sudomer-hex.html`, `web/hex-diorama/{boot,view,bridge,panels}.js`, `web/hex-diorama/style.css`, `web/hex-diorama/sudomer-art.json`, `scripts/build_sudomer_hex_wasm.sh`, and focused `scripts/hex-diorama/` tests/tools/fixtures. Use `benchmark-results/sudomer-hex/` for evidence and `plans/005-sudomer-hex-diorama.md` for progress.

Vendor the pinned reference into `web/hex-diorama/vendor/husitske-valky/` with LICENSE, provenance SHA, file list and hashes. Copy only the runtime dependency closure, relevant locale files, and needed test helpers; keep original paths for auditing. No runtime absolute paths or HTTP requests to the friend's site. Keep vendor files unchanged where feasible; isolate unavoidable compatibility edits with a small documented patch file and tests. Never load `js/ui/main.js`, analytics, original menu bootstrapping or the original app's event listeners in the prototype.

Reuse models/textures by path. Adapt the small diorama-specific renderer routines into new modules with origin comments rather than refactoring shared rendering underneath the running RTS task. Do not copy whole unused modules. Leave existing `src/diorama/*`, `src/sudomer/*`, `web/index.html`, the old pages and `scripts/build_wasm.sh` unchanged for the first standalone experiment. A direct URL is sufficient.

Minimal additive Cargo changes may add `serde`/`serde_json` for a typed snapshot protocol, reusing lockfile-compatible versions after the normal dependency health check. Coordinate shared Cargo edits with the existing task if both need them; inspect before and after, never regenerate over another task's edits. No npm framework, bundler, new package manager, networking backend or broad dependency upgrade.

## Logical board and authored appearance

The engine owns the flat-top **odd-q offset** grid. Rust mirrors coordinates only for geometry/picking. With circumradius R=4 scene units:

```text
x = 1.5 * R * col
z = sqrt(3) * R * (row + 0.5 * (col & 1))
```

Subtract the complete board footprint's centre for display. Positive rows run toward positive z. Retain column/row IDs end to end; test the exact six-neighbor ordering from `HexGrid`, including odd/even columns. Picking uses camera rays against tile top polygons (or triangles), not a flat y=0 guess over raised tiles or nearest-centre selection outside the board.

Use joined hex top surfaces on a single shallow, soil-edged plinth, with quiet seams and a toggle to show all grid lines. Selected, reachable and attackable hexes always have unambiguous outlines/fills. Water and mud stay recognisable across tile seams; do not bevel every tile into an isolated floating platform. Heights are decorative and modest: start at 0 for dry ground/dam, -0.2 for mud, -0.25 for water. Elevation must never add range, defence, movement or line-of-sight rules absent from the engine.

`sudomer-art.json` supplies versioned board radius, palette, tile-keyed decorative overrides and off-board props, keyed to source scenario ID and revision. All 240 playable tiles retain the engine's terrain type. Grass, reeds, field strips and small stones may decorate appropriate tiles. Put the village/woodland vignette outside the playable footprint unless the source actually includes that terrain. Do not turn plains into blocking forest for composition. Keep the source causeway and both approaches visibly readable.

Use this initial display mapping, independent of unit health/stat calculation:

| Logical unit | Fixed-pose display |
|---|---|
| Ordinary infantry/shooters | 3 figurines on a compact formation base |
| Ordinary cavalry | 2 mounted figurines |
| Wagon | 1 existing crewed wagon, with an open/closed formation marker |
| Named commander or priest | 1 distinguishable figure with a banner/icon and label |

Keep fixed group size while a unit lives; show actual health and morale in the unit panel and a small health bar. Do not falsely equate one removed figurine with a specific number of deaths. On elimination remove the group or replace it instantly with a fixed casualty marker; neither blocks another logical unit unless the source rules do. One unit per hex remains the rule.

Fit all models/bases inside the hex's inscribed circle, including horse heads and wagon tow poles. Document display scales as miniature presentation units; physical metre scale and full human counts are explicitly not goals. Require a complete type-to-model mapping for every initial/reinforcement type, with no silent generic fallback. Existing weapon proxies are acceptable if clearly labelled in the unit panel. Selection outlines and side colours distinguish forces without recolouring every asset.

## Adapter and transport contract

JavaScript owns one `Game` instance and is the only authority for state, legal actions, fog, random outcomes, AI, turn sequencing and victory. Rust owns camera, geometry, picking, figurine presentation and particles. HTML owns accessible controls, unit details and result panels. Do not maintain an independent Rust combat clock, RNG, hit points or occupancy model.

The adapter `DioramaBattleView` implements every method consumed by `Game` and its systems. Use the source `TestBattleView` contract to find methods, but replace UI callbacks with real panel updates and snapshot publication. Presentation methods must not write to game fields. Deliberately disable only optional audio/tutorial/campaign persistence at the integration edge, with explicit tests that ordinary Sudoměř mechanics still execute. Resolve residual morale prompts as actual accessible dialogs; do not return a blanket no-op for a player decision.

For `HexGrid` construction, use a separate detached real Canvas 2D element and load its renderer dependency; never request a 2D context on Bevy's WebGPU canvas. Do not start the 2D rendering loop. This preserves source grid logic without inventing a parallel grid implementation. If source presentation hooks are still reached unexpectedly, fail visibly during development rather than silently dropping a rule effect.

Use a versioned JSON bridge, exposed under one `globalThis.SudomerHexBridge` object before WASM starts. Bind its functions via `wasm-bindgen` on WASM only. Suggested interface: `takeSnapshot()` returns empty text if unchanged, otherwise a complete serializable snapshot; `sendCommand(json)` enqueues a validated action and returns an acknowledgement. Keep transport in one Rust module. Native geometry tests use fixture snapshots and a fake command sink with no browser imports.

Snapshot fields: protocol version, instance generation, monotonically increasing revision, scenario/round/faction/state, busy/paused flags, tiles and terrain, units with stable IDs/type/faction/hex/health/morale/formation state, selected unit, legal moves/attacks/march targets, visible/explored hex sets, action availability, objective/result text and cosmetic events with unique IDs. Use actual source values; do not serialize DOM objects, class instances, circular references or hidden enemy details. Poll an inexpensive dirty flag per frame, parse JSON only on change, and publish complete state at logical mutations rather than every render frame.

Commands include instance generation, observed revision and a whitelisted action plus validated IDs/coordinates. All paths—HTML buttons, keyboard, 3D clicks and touch—dispatch through the same adapter. Revalidate against current game state/action APIs and reject stale, busy, AI-turn, paused or invalid actions. The Rust renderer never authoritatively moves a unit on click. Unknown protocol versions or malformed payloads show an error instead of partially applying state.

Movement presentation can use a brief rigid slide along the source path. Preserve the source `animateMove` promise contract and action lock: acknowledge completion exactly once, support source fast-forward, and resolve/cancel outstanding waits on reset, destroy, tab hiding or renderer failure. The authoritative hex comes from the engine, not the intermediate 3D position. A simple immediate move is an acceptable first implementation; don't invent animation waits that can deadlock AI. Cosmetic random variation must never consume the engine's random sequence.

Reset destroys the old Game, cancels its pending actions, increments instance generation, clears effects/selection and recreates the scenario. Old promises/events/commands cannot update the new game. Use a separate storage namespace or an in-memory storage adapter for this prototype; never read or write the original game's saves, even when hosted under the same origin.

## Milestones and gates

### 1. Pin and prove the source integration before drawing the board

Vendor the dependency closure with the MIT notice and source manifest. Use the actual script load order from `index.html`/headless harness, excluding application bootstrap. Build the new view adapter, isolated storage/audio integrations and plain HTML diagnostic state display. Start Sudoměř with the same settings as a baseline source run; default to the source's no-fog/beginner configuration and record it. Preserve actual scenario fog events rather than turning off mechanics globally.

Create `node scripts/hex-diorama/test-reference.cjs`. It runs the original pinned engine with its headless view and the vendored engine with the new adapter under equivalent DOM/timer fixtures and identical controlled random streams. Fail if the reference SHA is unexpected. Normalize only wall-clock/UI fields, never health, morale, positions, actions, events, RNG consumption or results.

**Gate:** the test exits 0 and proves initial terrain/deployment counts, basic selection/move/end-turn flow, expected source move costs, and identical logical snapshots between adapters. A diagnostic browser boot completes an AI turn with no missing DOM/global dependency errors. If the engine cannot be isolated without rewriting rule systems, stop here and report the specific couplings; do not quietly switch to a Rust port.

### 2. Build the authored board from source snapshots

Create `sudomer_hex` binary and `src/hex_diorama/` modules. Start from existing diorama lighting/material/plinth patterns and models, not the accurate terrain viewer. Deserialize one reference snapshot and build all tiles with stable coordinate IDs. Add camera and native fixture mode for visual iteration. Author the art JSON and validate its keys/terrain constraints.

Add Rust inline tests for odd-q centres, all 240 coordinate round-trips, odd/even neighbors, point rejection outside edge polygons, raised-tile picking, decorative override validation and full model footprint containment. Use computed mesh/model extents rather than judging fit only by eye.

**Gate:** `cargo test --bin sudomer_hex` and `cargo check --bin sudomer_hex` exit 0. Native fixture view and WASM snapshot view show the two ponds, narrow route, complete board edges and static groups without overlap. Save overview and close-up captures compared with `/diorama.html`. No geographic map data is required or changed.

### 3. Connect 3D selection and complete player controls

Connect the bridge and drive scene updates by stable unit IDs. Left click/tap selects a friendly unit; a reachable hex moves, an attackable unit attacks, and a neutral/enemy tile can be inspected only to the extent source visibility permits. Hover/focus previews use the source's legal move and damage-preview APIs. Add visible unit-action buttons for every action available to a Sudoměř unit, including wagon formation/group march, defend, undo and choral ability where the source allows them. Read source panels for conditions; do not implement only a subset and claim rule parity.

Right-drag orbit, middle-drag pan, wheel zoom; touch drag orbit and two fingers pan/zoom. Taps are canceled after a drag/pinch; HUD clicks never pass through to the board. Provide a camera reset, grid toggle, End turn, Pause/Resume, Restart and explicit AI status. Use readable unit/type/terrain names, health, morale and remaining actions. Controls are HTML buttons with keyboard focus and touch targets; don't put critical actions only in tiny 3D icons.

**Gate:** `node scripts/hex-diorama/test-bridge.cjs` passes valid/invalid/stale commands, busy/AI-turn restrictions, reset generation, protocol errors, hidden-unit filtering and event deduplication. Rust picking tests pass. Browser tests at 1440×900 and 390×844 verify legal highlights, all available actions, input gesture separation, no horizontal overflow and readable unit details. Game state remains unchanged while merely orbiting or toggling the grid.

### 4. Prove gameplay parity through Sudoměř's full arc

Expand the differential Node tests to cover real source move/attack sequences, equal controlled RNG consumption, counterattacks, terrain modifiers, commander/cleric abilities, wagon open/closed and adjacency bonuses, march, undo, morale/routing, regeneration if applicable, round transitions, turn-6 reinforcement placement including blocked spawn handling, turn-10 event behavior, and all source victory/defeat variants. Inspect live functions to define expectations; do not substitute historical prose for implemented mechanics.

Use small synthetic setups for specific edge cases where appropriate, with exactly the same setup applied to both engines. Also run at least one complete Sudoměř command sequence with actual source AI and a reproducible random stream to a terminal result. Include the case where only the enemy commander remains. Capture and compare health, morale, alive/dead/routed IDs, occupancy, action flags, rounds, processed events and result after each settled action.

Add lifecycle tests: reset during AI/action waits, pause/resume, renderer failure, tab visibility changes, and ten consecutive restarts. Verify the old generation cannot spawn late reinforcements or publish a result into the new game. These are integration tests; comparing two references to the same mutable Game instance is invalid.

**Gate:** `node scripts/hex-diorama/test-reference.cjs` and `node scripts/hex-diorama/test-bridge.cjs` pass all cases. Browser playthrough reaches a genuine result, can restart and play again, and shows no missing units or duplicate effects. Do not declare parity based only on identical initial maps or source files.

### 5. Finish visual readability, smoke/dust and the standalone build

Add restrained smoke for firing and dust for movement using the existing diorama style. Effects are presentation-only and respect visibility, pause/reset, unique event IDs and a small particle budget. Figures remain fixed-pose; animate no horses. Make water/mud/firm ground, side identity, open/closed wagons and selected units readable at the default camera and a close view. Keep decorative props below/away from important unit silhouettes; grid and highlights always remain legible.

Create `scripts/build_sudomer_hex_wasm.sh` following existing Cargo/wasm-bindgen/cache-hash conventions, packaging only this binary, page, adapter, pinned vendor files and reused assets into `web/dist`. Preserve all existing dist pages. A fresh output directory must work without absolute local paths, the source clone, network access or the original game's index page. Include adapter/vendor content in cache invalidation, not just the WASM hash. Document `node` and Rust tooling versions used; do not introduce npm if plain scripts suffice.

**Final gate:**

```sh
node scripts/hex-diorama/test-reference.cjs
node scripts/hex-diorama/test-bridge.cjs
cargo fmt --all -- --check
cargo check --all-targets
cargo test --bin sudomer_hex
cargo build --release --target wasm32-unknown-unknown --bin sudomer_hex
./scripts/build_sudomer_hex_wasm.sh
```

All exit 0; distinguish unrelated failures from concurrent plan 004 work rather than editing it. Test the packaged page through the integrated browser on the existing project server if possible. Before starting a new server check the port owner; bind `0.0.0.0`, register/annotate persistent servers with PortPilot as required, and report verified loopback/LAN/Tailscale URLs. No deployment or push.

Record a 30-second browser WebGPU measurement after asset warm-up, with the whole populated board and effects visible at 1280×720. Target median frame <=16.7 ms and p95 <=33.3 ms on the development machine. Record actual hardware/backend and results; a miss requires diagnosis or an explicit unresolved limitation, not silently removing figures or scenery. Verify changing visual quality does not change any rules snapshot or random consumption.

Save a concise verification report and matched overview/close-up/mobile screenshots under `benchmark-results/sudomer-hex/`. Include completed parity cases, actual runtime performance and any deviations. Keep prototype run instructions in `web/hex-diorama/README.md` to avoid concurrent project-README edits; link the deliverable from this plan/index. Existing `/`, `/diorama.html` and `/battlefield-study.html` must still load.

## Acceptance checklist

- [x] M1: pinned, attributed JS source runs Sudoměř through the replacement adapter.
- [x] M2: 20 × 12 authored 3D hex board uses existing diorama style and compact figurine groups.
- [x] M3: 3D picking, legal actions, desktop/touch controls and state bridge verified.
- [x] M4: differential full-arc rule tests, source AI, terminal results and reset lifecycle pass.
- [x] M5: static figurines with smoke/dust, packaged browser build, visual checks and measurements complete.

## Implementation evidence

- Source pinned at `dbdf61907212476cda816ff2036a9a8d41bf3572`; MIT license, provenance, compatibility patch and SHA-256 manifest are under `web/hex-diorama/vendor/husitske-valky/`.
- `test-reference.cjs` proves terrain/deployment, movement cost, wagon action, combat/counterattack, choral, AI, turn-six reinforcements, turn-ten event and terminal result parity between independent source and adapter instances.
- `test-bridge.cjs` proves malformed/invalid/stale/busy/AI-turn rejection, hidden-unit filtering, event IDs, pause/cancel lifecycle, generation fencing and ten restarts.
- Twelve Rust tests cover odd-q geometry, 240 centre round-trips, neighbor parity, raised terrain picking, polygon rejection, authored palette/override validation, real-manifest model footprints and mouse/touch gesture separation.
- Final scripted gate passed: reference tests, bridge tests, formatting, all-target checks, Rust tests, release WASM build, standalone packaging and vendor-manifest verification.
- Packaged browser verification covered real 3D selection, inspection and damage preview, legal/action panels, wagon formation controls, grid, pause/resume, choral, AI fast-forward, a localized terminal result, restart and responsive layouts. The final authored landscape meets the frame budget and passed the combined reference comparison in `design-qa.md`.

## Stop conditions and follow-up

Stop the affected stage if pinned source behavior changes, rule APIs require broad upstream surgery, a concurrent edit conflicts, or asset/renderer integration cannot preserve the agreed diorama look. Explain the failing command/interface and next concrete option. Fix normal implementation errors within scope; do not ask the user to choose every tuning value.

The reference is MIT licensed; retain copyright/permission notices for copied code and identify visual/rule provenance. Historical labels must distinguish the abstract scenario from a surveyed reconstruction. If a source bug emerges, document it and reproduce it before proposing a separate fix; do not hide a gameplay divergence in rendering work.

After completion the user compares this with plan 004. Do not automatically abandon either direction, merge their rule systems, start a campaign, or import more battles. The reusable parts should be modest: a view adapter, an authored art file and a renderer for the source grid. A second map can later prove reuse without a new engine.
