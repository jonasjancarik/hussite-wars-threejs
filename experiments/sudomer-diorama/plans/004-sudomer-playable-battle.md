# Plan 004: Full-scale playable Sudoměř

`read_when`: implementing the first playable battle on the sourced Sudoměř landscape.

Status: PARTIAL IMPLEMENTATION. Milestones 1–2 complete; later systems are implemented in playable form but milestones 3–7 retain the verification gaps recorded below. Prepared 20 September 2026 for **Sol, medium reasoning**. Priority P1; large effort; high integration risk. This is an implementation handoff, not a historical reconstruction certification.

## Executor brief

Work in `/Users/janca/projects/battle-game`. Read this entire plan, then execute milestones in order. Finish and verify one milestone before starting the next; record its result in the checklist below. Do not replace an unfinished milestone with a mockup and call the battle complete. If a session ends, leave the next action and exact verification state here so another Sol session can continue.

The requested experience is a real-time battle with pause, at full participant scale, on the existing miniature-style 3D Sudoměř terrain. The player deploys wagons, defends a firm approach and a muddy flank, commits reserves, and survives until dusk. We are testing whether these decisions are enjoyable. A turn-based conversion remains an option for later; do not build two engines now.

**Visual decision, confirmed by the user:** static tabletop figurines throughout. People, horses and crews keep fixed poses at every distance. Pieces translate and turn rigidly to execute orders; this necessary battlefield movement is the only unit motion. No skeletal animation, walk cycles, bobbing, attack/reload/death animation, moving wheels or animated flags. **Smoke and dust effects are explicitly allowed**, including animated particles; the static requirement applies to the figurines. Keep effects cosmetic, freeze them with battle pause, clear them on reset, and include their cost in performance measurements. Show firing/engagement through steady state markers and health/count changes, with smoke where useful. An incapacitated figure changes instantly to a fixed fallen pose. Keep camera interaction and direct UI state updates. Do not introduce a near-camera animated figurine mode later in this plan.

Full scale means **one logical person and one visible person per participant**, with formation-level orders. It does not require individual strategic AI or physics per person. Never reduce the roster for performance, enlarge models to imply more people, or make a figure represent ten soldiers. Normal occlusion and frustum culling are fine; distance detail must retain all participant positions.

There is no Git repository at this workspace as inspected (`git status` reports `fatal: not a git repository`). Do not initialize one, switch branches, or invent a baseline commit. If Git exists when you start, inspect its status and preserve unrelated changes; commit logical completed stages under the user's ordinary rules, without pushing.

## Scope and current state

Rust 1.95.0, Bevy 0.19.1, Cargo, native Metal and browser WebGPU. No new runtime dependencies are expected. Follow existing component/resource/plugin patterns and inline `#[cfg(test)]` modules.

Current entry points and important facts:

- `src/bin/real_terrain.rs:41`: the browser root's landscape viewer. Registers `(setup, landscape::spawn)` in Startup; orbit/pan/zoom/capture in Update. It has no battle simulation. Its left drag pans and right drag orbits.
- `src/sudomer/mod.rs`: `SIZE = data::WORLD_SIZE_METRES`, `HEIGHT_SCALE = 1.0`, public `land(x,z) -> [u8;4]` and `height(x,z)`. One scene unit is one metre. `land` returns class, pond ID, road mask and strip ID; both samplers clamp outside the map, so navigation must reject out-of-map positions first.
- Land classes: water=1, drained basin=2, woodland=3, farmland=4, meadow=5, settlement=6. `height` on ponds is below the separately drawn surface; add an explicit walkable-surface sampler for mud rather than burying feet there.
- `src/sudomer/scenery.rs:100`: five decorative `war_wagon` scenes and a banner. Exclude these only in the new battle mode. Preserve them in the landscape viewer.
- `blender/build_assets.py:167`, `wagon()`: each wagon GLB contains **two baked-in people** (`Wagon_pikeman`, `Wagon_gunner`). These cannot remain as extra uncounted figures.
- `src/main.rs` calls `diorama::run(true)`. That separate art-directed scene uses `src/vignette.rs`, whose `BattleClock` wraps every 24 seconds and whose click order changes every `Attacker`. Do not use this as the battle engine; neither selection nor combat exists there.
- `src/bin/army_benchmark.rs:315`: stable soldier roots plus either `WorldAssetRoot` or shared `Mesh3d`/material presentation. Reuse this pattern, not the benchmark itself as the game.
- `assets/models/benchmark/`: flattened shield, polearm and handgun infantry. Existing cavalry is an animated GLB. No flattened cavalry benchmark proves the requested performance.
- `src/diorama/game.rs`: `play_when_ready` attaches cavalry animation through `WorldInstanceReady`; do not reuse it in the new battle. Existing study animations stay outside this change's scope.
- `web/index.html` loads `real_terrain`; `scripts/build_wasm.sh` packages several independent pages and copies assets into `web/dist`. Change source pages, never hand-edit generated dist files.

Inspect `plans/002-hybrid-soldier-visuals.md` for the agreed stable-root rendering policy. The user's subsequent static-figurine decision removes the need to preserve cavalry animation. Start with shared static meshes for all figures at all distances. Detailed static presentation nearby is optional only if a matched close-up demonstrates a worthwhile improvement within the performance budget; if added, use formation-level switching, hysteresis and limited upgrades per frame. This plan does not require retrofitting every old study.

`plans/003-procedural-landscapes.md` is not a prerequisite. Use the existing Sudoměř data directly; do not build the generalized landscape generator. Current metric source code and plan 003 take precedence over stale scale descriptions in the terrain asset README.

### Allowed changes

Create `src/bin/sudomer_battle.rs` and `src/battle/` modules for scenario, model, navigation, movement, presentation, input, combat, AI, objectives, UI and diagnostics. Keep pure rule helpers independently testable. Use `#[path = "../battle/mod.rs"] mod battle;` in the new binary, matching existing binary module imports.

Small shared changes are allowed in `src/sudomer/mod.rs` and `scenery.rs` to expose walkable heights, collision footprints, and a default-on decorative-wagon option. Keep the existing viewer working with defaults. Put battle-specific camera/input in `src/battle/`; do not refactor all camera implementations.

Also allowed: `web/sudomer-battle.html`, one link from `web/index.html`, additive packaging in `scripts/build_wasm.sh`, a focused `scripts/build_sudomer_battle_wasm.sh` helper, a scoped `blender/build_battle_assets.py` exporter, new assets under `assets/models/battle/`, corresponding provenance/manifest documentation, project README, this plan/index, and verification evidence under `benchmark-results/sudomer-battle/`.

Do not change old vignette behavior, benchmark baselines, geographic source bytes, pond geometry, vegetation style, toolchain or dependencies. Do not modify `/Users/janca/oss/husitske-valky` or `/Users/janca/projects/procedural-worlds`. No campaign, multiplayer, save system, strategic map, artillery, siege mechanics, horse dismounting, or per-person rigid-body combat in this slice.

### Drift check

Run `shasum -a 256` on these files before editing. The inspected hashes are:

```text
ebc7e8eda0567d96c684f2f638c1e88350ef7a6375eb4db6e716c122a263004d  Cargo.toml
1ec0380151d3b543eb89615206a62abb5de979e6b5fcc1066eb6fb1aec8d8d43  src/bin/real_terrain.rs
82dc41899764bc2fcf307c64b357e03e53e04bf276b7893aafc096e25532bac3  src/sudomer/mod.rs
f66ec9eea8c065637e1e4059a3a3a237fd0972f5c20645fa3ea7e5ad58c69d65  src/sudomer/scenery.rs
4c27611ec9904029db73e0e904bcab1a9e2b78630af4b32c8eebe661e8fc7aef  src/vignette.rs
3d48d2d0b5a96f72e986b5d7ed5bc69b2c2d1f5e91d18b697d307110f918e95c  src/bin/army_benchmark.rs
fa5ce6e6992a26204309d28b9acb01861e9aec445267eb419c855ce2edde6d67  scripts/build_wasm.sh
```

A difference means re-read that file and adapt to compatible changes. Stop only if an actual conflict changes the agreed behavior or makes this plan inapplicable. Do not revert other work to satisfy the hashes.

## Scenario and historical assumptions

Friend's reference: `/Users/janca/oss/husitske-valky`, inspected main commit `dbdf61907212476cda816ff2036a9a8d41bf3572`. Start with `js/data/scenarios.js:399`, `js/data/battleLore.js:70`, `js/i18n/locales/en.json:30`, and `docs/HISTORICAL_AUDIT.md`. Its game uses abstract unit tokens, 12 turns, a turn-6 wave and survival conditions. Do not copy those tokens as headcounts or its hex map as surveyed geography.

The linked [VHÚ account](https://www.vhu.cz/bitva-u-sudomere-s-vozy-proti-zeleznym-panum/) describes a travelling group including noncombatants, restrictive terrain, wagons, fighting until dusk and continuation toward Tábor. Numbers and leadership are uncertain. See `plans/sudomer-reference.md` for the source comparison. This plan adopts explicit game assumptions below; none of the detailed roster, timing, weapons mix or deployment is asserted as documented history.

### Required full-size rosters

Default: **400 Hussite-side people, 12 wagons, 2,000 opposing riders**. Also provide an **800-rider** preset because estimates differ. Both use identical rules and 1:1 people. The 2,000 preset is the required performance target, not an optional stress test. Count horses and wagons separately from people.

| Hussite role | People | Organization |
|---|---:|---|
| Wagon crews | 60 | 12 wagons × 5 people; two firing positions and three adjacent crew slots per wagon |
| Handgunners | 60 | 2 formations × 30 |
| Shield/polearm infantry | 120 | 3 formations × 40 |
| Foot reserve | 51 | 1 formation; includes commander identity |
| Mounted reserve | 9 | 1 formation |
| Noncombatants | 100 | 4 groups × 25; no attacks |
| **Total** | **400** | **300 combatants, 100 noncombatants** |

Enemy: 20 formations × 100 riders in the default, or 8 × 100 in the alternative. Commander identity occupies one existing rider slot. The all-mounted opposition is a first-pass abstraction, not an exact order of battle. Use existing cavalry art without claiming it accurately represents every troop type. No additional people arrive as reinforcements: later waves release already counted reserves.

Noncombatants need visibly unarmed presentation; derive one modest unarmed adult proxy from existing source assets and label the group as an abstraction, not a reconstruction of age/sex distribution. Export crewless wagons for the battle and place all crew as tracked people. Do not subtract decorative people from counts while retaining invulnerable visual crews.

The UI says “400 people · 12 wagons” and separately shows combatants and noncombatants. The preset note says “Scenario estimate; historical numbers are uncertain.” Do not call 400 people “400 soldiers.”

## Rules and architecture

These defaults make the handoff executable. Keep them together in typed Rust scenario/tuning structs, not scattered constants. No general-purpose scenario editor or serialization dependency is needed.

- `PersonId` and `FormationId` are stable numeric IDs. Each person has side, role, formation, physical position, health and state (`Active`, `Routing`, `Escaped`, `Incapacitated`). A mounted person owns one horse visual, not a second human record. A wagon has its own ID, crew IDs, footprint, deployment progress and health.
- Formations own orders, facing, slot layout, morale and paths. Root positions are authoritative; render children never determine combat. Maintain the identity model from plan 002 when visuals switch.
- Run rules at **20 Hz fixed simulation ticks**; render interpolated transforms separately. At each tick process commands, AI decisions due, movement, attacks from a shared pre-damage snapshot, accumulated damage, morale and objectives in that order. Stable ID order breaks ties. No wall-clock or render-frame dependence in rules.
- Use deterministic damage accumulation initially; no random hits required. Same preset and tick-indexed command stream must yield the same outcome on the same build. No promise of cross-platform bit-identical floating point.
- States: `Preparing`, `Running`, `Paused`, `Victory`, `Defeat`. Preparation has no timer or attacks and allows placement only in validated defender zones. “Begin battle” starts running. Pause freezes all simulation timers and piece movement but allows camera movement and orders for resume. Reset removes battle entities, clears commands/paths/timers/selection, and returns to preparation; terrain need not respawn.
- Runtime duration: **600 simulation seconds** to dusk. This compresses the historical afternoon; label it as scenario time. Enemy main group advances at start, flank group at 90 seconds, reserve at 180 seconds. At dusk freeze the result, do not run an elaborate withdrawal cutscene.
- Enemy assignments: default 12 main, 4 flank, 4 reserve formations; alternative 4 main, 2 flank, 2 reserve. All are on the map at start. Update AI at 2 Hz; use approach waypoints and local target selection. Do not path straight toward the nearest human through ponds.
- Victory at dusk: at least 200 of the original 400 people survive, including at least 75 noncombatants. Active, routing and escaped people count as survivors; incapacitated people do not. Early victory if every enemy is incapacitated or escaped. Routing enemies still on the map are not eliminated. Immediate defeat if either survival threshold becomes impossible, or no defender combatant remains active. Resolve defeat before victory on a tied tick. UI always shows exact conditions. These are game rules, not historical casualty claims.

### Movement and navigation

Use a CPU navigation grid derived from the existing land raster, initially at its approximately 2.9 m cell size. Reject map exits, water, building footprints and slopes above 30 degrees. Woodland is traversable with a cost; decorative individual trees/reeds are not collision objects. Register house footprints from the same data that places them. Do not confuse all settlement-class ground with a building.

Use A* for formation routes and deterministic spatial occupancy for local movement. Plan in movement class and required clearance; prohibit diagonal corner cutting. A successful centre route alone is insufficient: all person slots and the swept wagon footprint must fit. Narrow a formation into columns before a choke, restore width only after space opens, and queue following formations. Bound replanning work per tick; do not run A* for every person. If blocked, wait/replan and show “Route blocked”; never teleport, overlap through an enemy, or slide across water.

Initial speeds in m/s: foot 1.4, mounted 3.0, moving wagon 0.8. Mud multipliers: foot 0.5, mounted 0.25, wagon 0.35. Woodland: foot 0.7, mounted 0.4, wagon blocked. Person spacing: foot 1.2 m lateral/1.5 m depth; mounted 2.0 m lateral/3.5 m depth. Check model extents against these assumptions. Preserve physical scale rather than squeezing models into the route.

Choose and record actual deployment polygons, wagon line, both approaches and retreat exits from `assets/terrain/sudomer/layout.json`, raster and geographic-plan image. Validate both approaches are connected and the flank actually crosses mud. Do not assume the decorative wagons are correctly placed. If the existing geometry cannot support this encounter at physical scale, report the failed corridors with an overlay; do not move ponds or silently shrink people.

### Minimal combat and morale

Implement formation orders `Move`, `Attack`, `Hold`, `Withdraw`, plus wagon `Deploy`/`Pack`. In preparation allow position/facing edits; during battle both wagon transitions take 15 seconds. Wagons cannot move while deployed or transitioning. Defence protection exists only when deployment completes and crew remain; do not grant immunity during setup.

Use a spatial grid for nearby opponents. Only individual people in range can contribute damage; prevent an entire deep formation dealing damage through its front rank. Assign damage to stable eligible target IDs with accumulated fractional damage. All persons start at 100 health; at zero become incapacitated, cease contributing, and have a non-standing visual state. No extra clone appears on death.

Starting tuning: foot melee range 1.8 m at 8 damage/second, mounted range 2.5 m at 10 damage/second; handgun and wagon firing positions range 60 m, a 20-damage shot every 8 seconds. No separate crossbow model is required. Check terrain/building/wagon obstruction on ranged segments; allow crew to fire out of their assigned wagon. Friendly people do not block ranged fire in this first abstraction, and there is no friendly fire. In mud, mounted melee damage is multiplied by 0.5 as well as losing speed. A completed wagon provides a 0.5 incoming damage multiplier to its attached crew, not to the whole nearby army. Wagons have 800 health; at zero lose protection, become nonblocking wreck visuals, and surviving crew fight on foot. Enemy attack orders can target occupied wagons. No charge bonus in the first slice.

Morale starts at 100; each newly incapacitated member subtracts `100 / initial_formation_count`; losing the commander once subtracts 10 from formations on that side. At morale <=35 the formation routes irreversibly toward its validated friendly exit, stops attacking, remains vulnerable, and becomes escaped only after crossing the exit. Each wagon crew is its own formation for morale. Civilian groups withdraw toward their exit when an enemy is within 40 m; they never acquire attack targets. Routing and withdrawing use navigation and collision, not a straight line off-map.

These values are starting parameters. Tune them after mechanics pass, keeping before/after values and the reason in the verification note. Do not change roster counts, physical scale or victory accounting to make the scenario winnable.

## Milestones

### 1. Establish the battle shell and data contracts

Create the new binary/plugin and typed scenario/state model. Add the roster presets, IDs, exact accounting invariants, lifecycle and fixed-tick runner. Load the same landscape with decorative wagons disabled through a default-preserving option. Add the new standalone web page and focused build helper; keep the root landscape page available with a “Play Sudoměř” link.

Capture baseline `cargo test --all-targets` before edits; report pre-existing failures separately. Add inline tests in `scenario.rs` and `model.rs` asserting 400 = 300 + 100, 12 wagons, 60 crew IDs, 2,000/800 enemy humans, 2,009/809 mounted people total, unique IDs and no surplus commanders.

**Gate:** `cargo test --bin sudomer_battle` and `cargo check --all-targets` exit 0. `cargo run --release --bin sudomer_battle` loads the unchanged landscape and reports selected roster totals. A short-lived empty-roster shell is a milestone only, not completion.

### 2. Render the entire roster before implementing combat

Export crewless wagons, an unarmed proxy and one shared static horse+rider mesh from the existing assets in a deliberate standing pose. Bake transforms and vertex colours, retaining physical dimensions and the recognisable geometry. The same static cavalry asset is used near and far. No animation clips, animation players or gait systems belong in this battle. Do not use the infantry flattening script unchanged on animated source horses: explicitly evaluate the selected fixed pose before baking geometry. Reuse existing source geometry; do not regenerate the whole asset library.

Spawn every person at validated initial positions at 1:1 scale. Preserve logical roots through any presentation switches. Use shared static infantry and cavalry at all distances initially. Count all crew independently. Make quality settings affect shadows/detail, never roster or combat. Add an assertion that battle participant descendants have no `AnimationPlayer`, and visually check that moving pieces keep their poses.

**Gate:** `cargo test --bin sudomer_battle` passes tests for visual replacement preserving IDs/state and reset removing only battle entities. Native and browser captures show the whole default force and a close-up of wagons/cavalry/noncombatants. Record entity counts and a 30-second full-roster idle performance sample. If native or WebGPU is already below the final target, fix presentation cost before continuing.

### 3. Prove terrain-aware movement at full scale

Implement `navigation.rs`, `movement.rs`, shared collision footprints and walkable-height sampling. Record authored scenario coordinates. Add a debug overlay for passability, routes, formation footprints, deployment zones and exits; keep it off by default. Initially use scripted formation orders so UI does not conceal movement defects.

Tests: blocked water and out-of-map requests; building avoidance; no diagonal corner cutting; foot/cavalry mud timing; swept wagon clearance; corridor narrowing/reforming; two formations queuing; unreachable destination without a hang; actual firm and muddy approach connectivity. Exercise the real map in addition to synthetic grid fixtures.

**Gate:** `cargo test --bin sudomer_battle navigation` and `cargo test --bin sudomer_battle movement` pass. Observe a full-roster crossing test in the browser: no pond crossing, persistent formation interpenetration, buried feet or teleporting. A path at the centre with soldiers visibly in water fails this gate.

### 4. Add selection, orders and preparation

Implement battle-specific camera/input and UI. Left click selects a formation; left click terrain orders selected formations; clicking an enemy gives Attack. Shift-click adds/removes formations. Right drag orbits, middle drag pans, wheel zooms, F frames, Space pauses, R resets. Use distinct pointer-down/up drag thresholds so camera gestures do not issue orders. Touch: tap to select/order, one-finger drag orbit, two-finger pan/zoom; cancel taps after pinch or drag. UI input consumes the pointer event.

Provide buttons for Begin battle, Pause/Resume, Hold, Withdraw, Deploy/Pack and Reset. Show selected count, current order, deployment progress, people remaining and dusk countdown. Keep civilian groups selectable for withdrawal, never armed. Make invalid placement/order reasons visible. Frame the actual battle at start rather than the entire 2.2 km map; F must still include both forces.

**Gate:** `cargo test --bin sudomer_battle input` passes click/drag/UI-consumption cases and `cargo test --bin sudomer_battle model` passes pause/command/reset cases. Browser check at 1440×900 and touch-sized 390×844: select, place, begin, pause, queue an order, resume, orbit and reset. Ten resets preserve identical roster totals and stable entity counts after assets settle.

### 5. Implement combat, routing and results

Implement the specified combat rules, wagon vulnerability, casualty accounting, morale, exits and objective precedence. Use snapshot/accumulate/apply damage so iteration order does not decide who attacks first. No battle result may be driven by a scripted timer alone before the stated objective is satisfied.

Tests: attackers beyond frontage/range contribute nothing; dead/routing/noncombatant units do not attack; no fire through a house; wagon transition is vulnerable; wreck releases crew and removes protection; casualties counted once; simultaneous attacks; delayed attack timers freeze while paused; a rout does not kill or instantly escape people; exact dusk thresholds and tied defeat/victory; early victory excludes merely routing enemies.

**Gate:** `cargo test --bin sudomer_battle combat`, `... morale`, and `... objectives` pass. A small synthetic test fixture may make correctness tests fast, but manual combat and final measurements must use the default full roster. Verify visible losses match HUD counts and crew deaths cannot leave standing ghost gunners.

### 6. Add enemy pressure and a complete encounter

Implement the three groups, approach waypoints, release schedule and route-aware local targeting. Spread formations across available frontage; later formations wait behind the engaged front. Flank forces use the muddy approach. Enemies respond to nearby defenders and exposed civilians without omniscient global targeting; use a simple 100 m awareness radius and the same line obstruction check. Idle reserves remain counted and rendered.

Add `--headless-check --preset <standard|lower-estimate> --policy <hold|respond|exposed> --seed 1420` to the native binary before renderer initialization. This runs the same fixed-tick simulation to a result, without a window, and prints counts, tick total, result, invalid-position count and a deterministic state digest. Seed controls any authored variation; if no variation exists it is simply recorded. Exit nonzero for invalid state or a run that never terminates, not for a legitimate defeat. Avoid a separate simplified test battle engine.

Policies: hold deploys the initial line and holds; respond additionally commits the foot reserve to the threatened flank at 90 seconds; exposed leaves wagons packed and moves the foot reserve away from both approaches. Record outcomes and losses rather than assuming each policy must win or lose. Repeat identical commands to check determinism.

**Gate:** all three policies complete with the 2,000 preset, both repeated respond runs have equal digests, and `lower-estimate` completes too. All have conserved people accounting and zero invalid positions. A browser playthrough reaches a real result and presents survival totals. If the defence is solved entirely by doing nothing after deployment, report the balance problem and tune existing routes/timing/values; do not add unrelated mechanics.

### 7. Verify performance, package and hand off

Add measurement mode reusing frame-sample/percentile ideas from `army_benchmark.rs`, without changing those baselines. Support `--measure --preset standard --policy respond` for native; provide equivalent query parameters on the new page that reach Rust configuration, not an inert HTML-only toggle. Record the actual selected configuration in output. Browser results must be downloadable/exportable; do not rely on a writable native path in WASM.

Measure full terrain, all 2,400 people, 12 wagons, movement, combat and UI at 1280×720, native release and browser WebGPU. Warm up assets for 10 seconds. Record separate 30-second windows during initial advance, close fighting, and flank pressure. Include backend/device, quality policy, shadows, entity counts, total frame median/p95, simulation tick median/p95 and invalid positions. Frame the whole force during at least one window to expose accidental culling optimism.

Acceptance targets on the current development machine: native median frame <=16.7 ms and p95 <=25 ms; browser median <=33.3 ms and p95 <=50 ms; simulation tick p95 <=10 ms on both. These are targets, not predictions from the infantry benchmark. If missed, measure before changing architecture; optimize shared meshes, detail budgets, scenery/shadows or spatial-query work. Never downsample people. If still missed, retain the full-size implementation and mark this milestone BLOCKED with actual measurements instead of claiming full acceptance.

**Gate commands:**

```sh
cargo fmt --all -- --check
cargo check --all-targets
cargo test --all-targets
cargo build --release --bin sudomer_battle
cargo build --release --target wasm32-unknown-unknown --bin sudomer_battle
./scripts/build_sudomer_battle_wasm.sh
```

All exit 0. The focused script builds and runs wasm-bindgen for only the new binary, hashes its WASM for cache busting, produces `web/dist/sudomer-battle.html`, and copies required assets using the existing packaging convention. Integrate it into `scripts/build_wasm.sh` without removing any old outputs. Verify existing landscape and battlefield-study pages still load; do not rerun the entire army benchmark matrix.

Use the integrated browser for UI checks. Before using a local port inspect its owner; reuse the existing project server if appropriate. If starting a persistent server, bind `0.0.0.0`, register/annotate it with PortPilot under the applicable workspace instructions, and report verified loopback, LAN and Tailscale URLs. Stop only temporary processes/tabs you started. No deployment or push is requested.

Save concise results, captures and raw timing data in `benchmark-results/sudomer-battle/`; document the controls, presets, launch commands, historical assumptions and measured limitations in the README. Update plan/index status only when supported by evidence.

## Completion checklist

- [x] M1: shell, accounting and lifecycle tests pass.
- [x] M2: every participant is represented; crews/commanders are not duplicates; physical scale retained; all figures retain fixed poses. Cosmetic smoke and dust are allowed.
- [ ] M3: real-map approaches work; all moving footprints obey terrain and congestion rules.
- [ ] M4: desktop/touch orders, preparation, pause and repeated reset verified.
- [ ] M5: combat, morale, routing and results pass rule tests and visible accounting checks.
- [ ] M6: complete deterministic headless runs and browser playthrough; behaviour/balance observations recorded.
- [ ] M7: native/WebGPU performance targets measured at the full default count; build/test gates and old-page checks pass.

No claim of a playable full-scale battle until all seven are complete. Partial milestones are useful but must be reported as partial.

### Progress recorded 20 September 2026

The new battle binary, typed roster/lifecycle model, full 1:1 static presentation, dedicated battle assets, deterministic fixed-tick rules, desktop/touch input, combat/objectives, headless policies, browser page, focused packager and native/browser measurement paths are present. All-target tests and native/WASM builds pass. Repeated standard/respond headless runs have the same digest, all policies terminate with conserved rosters and zero invalid positions, and the isolated 30-second native and browser samples meet the stated frame budgets. See `benchmark-results/sudomer-battle/README.md` for raw evidence and the discarded-confound note.

Do not mark milestones 3–7 complete yet. Formation steering still lacks the planned corridor narrowing, deterministic congestion/queue resolution and debug overlay; the full navigation fixture matrix is incomplete. Browser checks did not cover ten resets, the 390 × 844 touch layout or a complete ten-minute manual playthrough. Combat tests do not yet cover every wagon transition and frontage case. Performance measurement has one opening window rather than separate advance, close-fighting and flank-pressure windows. These are remaining acceptance gaps, not hidden behind the successful build and headless results.

## Stop and report

Stop the affected milestone if the map cannot fit valid full-size approaches/deployments, assets cannot remove duplicate crew without breaking the viewer, or the implementation requires a dependency/engine change or excluded scope. Provide the failing coordinates, command/error or measured bottleneck and one concrete next option. Historical uncertainty alone is not a blocker: keep the documented scenario assumptions.

Do not let browser WebGPU failure become a claim of verified browser support. Report missing visual/runtime checks explicitly. Fix ordinary implementation/test failures within scope; do not stop merely because the first attempt fails.

## Maintenance

Headcounts, casualty totals and victory thresholds must stay tied to the roster. New quality modes must pass the same identity/accounting tests. New terrain or model dimensions require navigation-clearance tests, not just prettier screenshots. Performance evidence must include cavalry and actual combat; the old 50,000-infantry rendering benchmark is not a substitute.

The next product decision after this encounter is a playtest judgement: does deploying and adjusting the defence create interesting choices, and is real-time timing adding enjoyment? Record observations; do not automatically begin a campaign or turn-based rewrite.
