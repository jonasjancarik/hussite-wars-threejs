# Hussite battlefield visual POC

A Bevy 0.19.1 miniature battlefield based on the supplied concept image. The playable main scene combines moving formations and battlefield orders with an art-directed miniature landscape; it is not presented as a reconstruction of a named battle.

The separate Sudoměř landscape study combines official ČÚZK DMR 5G elevation, OpenStreetMap pond and land-use geometry, and a historical-map-informed miniature treatment. It includes mapped ponds, a drained Škaredý basin, strip fields, woods, and the village edge. It is an artistic interpretation, not an exact 1420 reconstruction. Geography, art provenance, and regeneration are documented in `assets/terrain/sudomer/README.md`.

## Run the native scenes

Rust 1.95.0 is pinned in `rust-toolchain.toml` without changing the machine-wide default.

```sh
cargo run --release --bin hussite-battlefield-poc
cargo run --release --bin diorama
cargo run --release --bin moving_battlefield
cargo run --release --bin real_terrain
cargo run --release --bin sudomer_battle
```

Main-scene controls:

- Left mouse: redirect the attacking formations to the clicked terrain position
- Right mouse: orbit
- Middle mouse: pan
- Mouse wheel: zoom
- `F`: restore the reference camera
- `Space`: pause/play
- `R`: reset the vignette and orders
- `P`: save `captures/battlefield-reference.png`

The main Sudoměř landscape supports left- or middle-mouse pan, right-mouse orbit, pointer-relative wheel zoom, `F` to frame, and `P` for `captures/sudomer-real-terrain.png`. Touch gestures support one-finger orbit and two-finger pan/zoom. Its Landscape study dialog contains the generated art reference and the 1837 cadastral reference. This viewer uses one scene unit per metre and 1× relief; V / View wagons frames the physically scaled wagon crew. Tree models are exported from the procedural-worlds generator.

## Browser build

```sh
./scripts/build_wasm.sh
python3 -m http.server 8082 --bind 0.0.0.0 --directory web/dist
```

The normal browser build uses Bevy's WebGPU backend. Browsers without WebGPU support cannot run these default pages; the separate 50,000-soldier WebGL 2 comparison remains available as a compatibility and performance reference. Native rendering remains the primary visual iteration target; native-only SSAO is not evidence of browser parity.

- Main Sudoměř landscape: `http://localhost:8082/`
- Playable full-scale Sudoměř battle: `http://localhost:8082/sudomer-battle.html`
- Art-directed battlefield study: `http://localhost:8082/battlefield-study.html`
- Held-still diorama: `http://localhost:8082/diorama.html`
- Turn-based Three.js hex battle: `http://localhost:8082/sudomer-hex.html`
- Retained Bevy hex comparison: `http://localhost:8082/sudomer-hex-bevy.html`
- Earlier moving battlefield: `http://localhost:8082/battlefield.html`
- Flattened 2,000-soldier default WebGPU check: `http://localhost:8082/army-benchmark.html`
- Flattened 50,000-soldier Bevy WebGPU check: `http://localhost:8082/army-benchmark-webgpu.html`
- Flattened 50,000-soldier Bevy WebGL 2 comparison: `http://localhost:8082/army-benchmark-webgl-50k.html`

## Integrated turn-based campaign view

The root campaign now loads the Three.js renderer on demand through `js/ui/ThreeBattleMapView.js`. Its terrain comes from the active root `HexGrid`, not from `public/sudomer-landscape.json` or the vendored rules copy. The same generator handles every campaign scenario; forest and settlement decoration is derived only from matching gameplay terrain. The standalone Sudoměř page below remains a renderer fixture.

`web/hex-three/src/terrain-regions.ts` is renderer-neutral. It merges same-terrain neighbours, applies deterministic coherent variation at region borders and preserves a protected core inside every source cell. The test suite measures area coverage across all campaign scenarios and keeps the 75% minimum explicit.

## Standalone Sudoměř hex battle

The default turn-based page uses the pinned JavaScript rules and AI with a Three.js WebGPU presentation. Build it without Rust or Wasm using:

```sh
npm --prefix web/hex-three install
./scripts/build_sudomer_hex_three.sh
```

The retained page uses the same generated renderer as the campaign and continues to use the Sudoměř fixture for bridge/parity checks. Procedural-worlds supplies the WebGPU/TSL render graph, lighting and atmospheric foundation, cursor-driven miniature focus and generated tree/shrub assets. Provenance is recorded in `web/hex-three/THIRD_PARTY_NOTICES.md`.

The build preserves every other page in `web/dist`. `sudomer-hex-three.html` is an alias of the default Three.js page, while `sudomer-hex-bevy.html` keeps the previous renderer for comparison. Add `?effects=off` to judge the composition without AO, depth of field or grading, or `?quality=photo` for the stronger photographic bokeh graph. Three.js can fall back automatically where supported, but WebGPU is the tested target and WebGL 2 compatibility is not claimed.

## Playable miniature battlefield

The main scene traces a generated overhead landscape study into editable woodland, field, road, village, and pond regions on a display plinth. Existing low-poly buildings, wagons, soldiers, and horses populate the terrain, with filtered shadows, distance fog, smoke, and cavalry dust providing the atmospheric pass. Attacking infantry and cavalry retain their formation movement; cavalry use the existing walk animation, and their dust follows their current positions.

Click or tap the terrain to redirect the attacking formations. Short taps give orders, while touch drags orbit and two-finger gestures pan or zoom without issuing an order. `Space` pauses movement, cavalry animation, smoke, and dust together; `R` clears the order and restarts the original advance; `F` restores the composition. This remains a stylized interactive study, not an exact reproduction or a historical reconstruction. The earlier moving scene and separate sourced Sudoměř fixture are retained for comparison. Texture provenance is in `assets/textures/README.md`.

## Tin-soldier diorama experiment

Open `http://localhost:8082/diorama.html` or run `cargo run --release --bin diorama` for a held-still version of the same miniature landscape. A generated overhead study was manually traced into editable regions that place woodland, fields, a track, village, and pond on the display tile.

The figures are fixed; only smoke, dust, and haze drift. On touchscreens, drag one finger to orbit, pinch to zoom, and move two fingers together to pan. On-screen buttons frame the scene and pause/resume atmosphere. The browser page includes the generated plan for comparison. Right-drag orbits, middle-drag pans, scrolling zooms, `F` restores the view, `Space` pauses atmosphere, `R` resets it, and `H` hides the overlay. The image prompt, provenance, mapping, and limitations are in `assets/diorama/README.md`. This is an imagined landscape, not a historical reconstruction.

## Rebuild the Blender kit

Blender 5.2 LTS generated the production assets through one deterministic script. Editable `.blend` files, GLBs, preview renders, and dimensions/polycount metadata are retained.

```sh
/opt/homebrew/bin/blender --background --python blender/build_assets.py
```

The kit contains a crewed war wagon, animated horse and rider, three infantry variants, church, farmhouse, two broadleaf palettes, cypress, stakes, chalice banner, and bridge.

## Refresh the sourced elevation fixture

```sh
uv run tools/terrain/fetch_sudomer_dmr5g.py
```

The crop, CRS, output extent, source height range, display exaggeration, attribution, and exact request URL are recorded in `assets/terrain/sudomer_dmr5g.json`. The source is the [ČÚZK DMR 5G ImageServer](https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer); the [ČÚZK Atom portal](https://atom.cuzk.gov.cz/) displays CC BY 4.0 for supplied data.

## Checks

```sh
cargo fmt --all -- --check
cargo check --all-targets
cargo test --all-targets
cargo build --release
```

## Native army-size benchmark

The separate `army_benchmark` binary measures the current one-scene-per-soldier representation without changing the playable scenes. It runs 2,000, 5,000, 10,000, 20,000, and 50,000 soldiers in sequence, with totals split evenly across both sides. Each run requests no-vsync presentation and records a static phase and a formation-movement phase at 1280×720, then exits before the next size starts. The actual presentation mode can still fall back to the display refresh rate.

```sh
./scripts/run_army_benchmark.sh
```

Raw per-frame CSV data and process logs are written under `benchmark-results/`. Override `BATTLE_BENCH_RESULTS_DIR` to select another output directory. The benchmark keeps all soldiers in the camera frame and uses the existing shield, polearm, and handgun infantry GLBs. Shadows and MSAA are disabled. It measures rendering plus root-transform movement; it does not implement collision, combat, morale, congestion, or pathfinding.

The focused flattened-mesh experiment retains the original geometry and bakes its material colors into one shared mesh/material per infantry variant. This removes the GLB scene hierarchy per soldier, at the cost of flattening the subtle metallic response of weapon and armor parts.

```sh
/opt/homebrew/bin/blender --background --python blender/build_benchmark_assets.py
./scripts/run_flat_army_benchmark.sh
```

The WASM build also exposes the flattened representation as a continuously running 2,000-soldier visual check at `http://localhost:8082/army-benchmark.html`.

## Full-scale Sudoměř encounter

The dedicated `sudomer_battle` binary and browser page render one fixed-pose figure for every participant: 400 defender-side people and 2,000 opposing riders by default, plus 12 separately crewed wagons. The alternative `lower-estimate` preset uses 800 opposing riders. These are scenario assumptions; historical numbers are uncertain.

People, horses and wagon crews never use skeletal, gait, attack or death animations. Whole pieces translate and turn for orders, incapacitated pieces switch immediately to a fixed fallen pose, and cosmetic smoke/dust freezes with pause and clears on reset.

Controls: left click or tap selects a formation or gives a move/attack order; Shift-click changes a multi-selection; right drag or one-finger drag orbits; middle drag or two-finger drag pans; wheel or pinch zooms. `Enter` begins, `Space` pauses, `F` frames the force and `R` resets. The HUD also provides Begin, Pause/Resume, Hold, Withdraw, Deploy/Pack and Reset.

Deterministic native checks:

```sh
cargo run --release --bin sudomer_battle -- --headless-check --preset standard --policy respond --seed 1420
cargo run --release --bin sudomer_battle -- --measure --preset standard --policy respond
```

Browser query parameters `preset`, `policy`, `seed`, `measure=1` and `effects=0` are read by Rust. The page can download the browser frame log. Current measurements and limitations are recorded in `benchmark-results/sudomer-battle/README.md`.

Hover a hex to see an ivory outline and translucent fill, including over water. Selected cells are gold, legal movement and march destinations mint, and attack targets coral. Hover strengthens the existing action color. The optional full grid remains subtle.

Pond and drained-basin banks use gently uneven outlines, shallow inlets and asymmetric outer shores rather than alternating zigzags. A uniform area-sampling regression requires at least 75% matching water, mud, or dry area for every gameplay hex (the current minimum is 76%). Dam cells are checked as dry ground; the causeway has its separate continuity check.
