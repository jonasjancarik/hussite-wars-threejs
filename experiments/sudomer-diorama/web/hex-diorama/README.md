# Sudoměř hex diorama

This standalone browser battle keeps the pinned JavaScript rules and AI from `husitske-valky`, now presented through a Three.js WebGPU miniature landscape. The terrain is authored independently from the rules grid: pond, drained basin, causeway, fields, woods and village are continuous scenery, while hexes appear only for selection and orders. The soil plinth remains part of the diorama composition.

Build it with:

```sh
npm --prefix web/hex-three install
./scripts/build_sudomer_hex_three.sh
python3 -m http.server 8082 --bind 0.0.0.0 --directory web/dist
```

Open `http://localhost:8082/sudomer-hex.html`. Click or tap a Hussite group to select it, then choose a highlighted destination or target. Hovering inspects visible terrain and units, shows source-backed damage estimates and smoothly places the miniature focal plane at the terrain under the cursor. Drag to orbit, use the middle mouse button or two fingers to pan, and use the wheel to zoom toward the cursor or a pinch to zoom; focus is suppressed during camera motion. The complete action set remains available as accessible HTML controls beside the board.

The new renderer is under `web/hex-three/`. It adapts the TSL render graph, light rig, painted sky, photographic focus behavior and batching from `/Users/janca/projects/procedural-worlds` at commit `bada861a8d5c8cb7275a1b3d6e6a3f4ea4844cf4`, and uses that project's exported deciduous trees and shrubs. Exact provenance is in `web/hex-three/THIRD_PARTY_NOTICES.md` and `assets/models/procedural-worlds/manifest.json`.

`sudomer-hex-three.html` is an alias of the default page. The earlier Bevy renderer remains at `sudomer-hex-bevy.html`; rebuild that comparison with `./scripts/build_sudomer_hex_wasm.sh`. The Three.js page has no Rust/Wasm runtime dependency. `?effects=off` disables AO, depth of field and grading for composition checks; `?quality=photo` opts into stronger photographic bokeh instead of the crisp default high profile. WebGPU is the verified target; the automatic WebGL 2 fallback is retained but not separately tested.

The vendored rules revision and MIT notice remain under `vendor/husitske-valky/`. Its only compatibility patch prefixes storage keys with `sudomerHex:` to keep the prototype isolated from the original game.
