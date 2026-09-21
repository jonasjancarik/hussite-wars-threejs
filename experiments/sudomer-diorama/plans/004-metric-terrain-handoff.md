# Metric terrain and Procedural Worlds trees — handoff

`read_when`: continuing the current metric terrain and tree-import task.

Status: implementation complete enough for final integration verification; do not declare finished until the corrected trees visibly load in Bevy.

## User request

Use one scene unit per metre, including 1× elevation, realistic wagon/crew/building dimensions, and trees generated using the actual Three.js procedural-worlds implementation. User prefers the original faceted/art-directed tree character over the handmade rounded tree experiment. User explicitly requested continuation in a new gpt-5.6-sol task with medium reasoning.

Work in `/Users/janca/projects/battle-game`. This directory currently has no Git repository, so no commits were made. Do not initialize Git or change branches just for this task. `/Users/janca/projects/procedural-worlds` must remain unchanged; it contains unrelated work. Its generator is read/imported only.

## Implemented this turn

- `tools/terrain/prepare_sudomer_landscape.py` now derives scene width from the actual projected DMR output extent: 2228.244868 metres. Regenerated landcover, surface data, pond geometry, layout and Rust constants.
- `src/sudomer/mod.rs`: one unit/metre, vertical multiplier 1.0, pond/terrain geometry in metres; old authored coordinates use an explicit conversion only to preserve geographic positions. Elevations remain relative to the crop minimum; their physical span is 46.72052 m.
- `src/sudomer/scenery.rs`: wagons and farmhouses at model scale one; five wagons spaced 5.6 m. Wagon overall model length 5.305 m (tow poles included), crew height about 1.75 m to helmet (weapons extend higher). House positions retained geographically. Tree sampling changed from 84×84 to 168×168 candidates, and assets switched to the PW exports below. Tree size variation is around physical exported dimensions, not the old map compression.
- `src/sudomer/surface.rs`: ground overlay coordinates follow actual grid spacing. Ground materials retain metre-scale repeats.
- `src/bin/real_terrain.rs`: overview distance/pan extent/shadow range/haze adapted to metre scale; orbit target follows local height +1.7 m; unlimited practical zoom retained with 0.05-unit numerical minimum and finite checks. V frames the wagon line at an 80 m camera distance; F restores overview.
- `web/terrain.html`: added View wagons button dispatching V. Existing Frame scene and reference dialog retained.
- Updated README, `assets/terrain/sudomer/README.md` and plan 003 with current metric policy, PW reuse and controls. Older experimental notes are explicitly superseded by the new Current metric scene section.

## Actual Procedural Worlds exports

`tools/vegetation/export-procedural-worlds.mjs` imports the exact `createTreeAssembly` and `createShrubAssembly` from `/Users/janca/projects/procedural-worlds/web/src/world/vegetation.ts`, using that checkout's installed Three.js and its official GLTFExporter. It writes only battle-game assets. Run with:

```
node --experimental-strip-types tools/vegetation/export-procedural-worlds.mjs
```

`PROCEDURAL_WORLDS_WEB_DIR` can select a different source checkout. See `tools/vegetation/README.md`.

Exports under `assets/models/procedural-worlds/`:

- `pw_deciduous_01.glb`: 10.8 m, 3258 triangles.
- `pw_deciduous_02.glb`: 14.2 m, 3318 triangles.
- `pw_deciduous_03.glb`: 17.5 m, 3278 triangles.
- `pw_shrub_01.glb`: 1.35 m, 120 triangles.

Source HEAD is `bada861a8d5c8cb7275a1b3d6e6a3f4ea4844cf4`. Manifest records HEAD blob IDs, actual imported working-file SHA256 hashes, deterministic seeds, output hashes, bounds and counts. Summer canopy shape is selected with an explicit custom static material palette; this preserves generator geometry, not exact source renderer lighting or animation.

### Corrected blocker requiring final verification

The first exports contained `EXT_mesh_gpu_instancing`. Bevy rejected every asset:

```
invalid glTF: extensionsRequired[0] = "EXT_mesh_gpu_instancing": Unsupported extension;
```

The worker corrected the exporter to bake internal instances into ordinary merged meshes. It re-exported all four assets, checked source-vs-baked vertex/triangle counts, reloaded them through Three GLTFLoader, and verified no extension remains in required/used lists. Heights and ground contact are preserved. The corrected files and manifest have just been copied into `web/dist/assets/models/procedural-worlds/`.

**They have not yet been reloaded and visually verified in Bevy after that correction.** This is the next action, not an unresolved modelling task.

## Checks already completed

- `cargo test --bin real_terrain`: 8 tests passed after metre conversion, including geographic samples, dimensions, house clearance and zoom/gesture tests.
- `cargo build --release --target wasm32-unknown-unknown --bin real_terrain`: passed; wasm-bindgen output and cache-busted terrain HTML are already packaged in web/dist.
- Focused Rust formatting passed.
- Browser showed the correct metre-scale terrain and tiny full-map wagons; View wagons successfully framed physically sized crew/wagons. At that time trees were absent due to the extension error above.
- Exporter validation passed after baking. No final browser proof of corrected exports yet. No full project test suite or performance benchmark was run.

## Finish the task

1. Reload the existing integrated-browser tab at `http://localhost:8082/terrain.html` and confirm imported trees appear. Inspect close-up shapes against PW, and verify overview plus View wagons/F controls.
2. Inspect **all console levels**, including ordinary `log`: Rust logs ERROR messages through console.log, so filtering only browser error/warn levels misses Bevy asset errors. Use a fresh tab if necessary to separate historical logs from current logs.
3. Check whether 168×168 placement candidates (several thousand trees, roughly 3300 triangles each) are practical for navigation. No performance claims without measurement. Do not silently reduce tree quality to solve a benchmark; investigate only if there is an actual problem.
4. Address any real integration defect, then give a short final report distinguishing metric scale, actual PW geometry reuse, successful checks and remaining limitations.

The pre-existing Python server on port 8082 serves `web/dist`, bound to 0.0.0.0. Leave it running; do not start/register a duplicate. URLs:

- http://localhost:8082/terrain.html
- http://macbook-air-2.local:8082/terrain.html
- http://macbook-air-2.adal-macaroni.ts.net:8082/terrain.html

For code changes, rebuild only the terrain binary and package it:

```
cargo build --release --target wasm32-unknown-unknown --bin real_terrain
wasm-bindgen --out-name real_terrain --out-dir web/dist --target web target/wasm32-unknown-unknown/release/real_terrain.wasm
terrain_version="$(shasum -a 256 web/dist/real_terrain_bg.wasm | cut -c1-12)"
sed "s/TERRAIN_VERSION/$terrain_version/g" web/terrain.html > web/dist/terrain.html
```

Asset-only changes need the corresponding files copied into web/dist/assets and a browser reload. No need to run the full multi-scene build unless broader changes justify it.
