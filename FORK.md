# Hussite Wars — Three.js diorama fork

This development fork preserves the history and MIT license of [josefslerka/husitske-valky](https://github.com/josefslerka/husitske-valky). The original campaign remains at the repository root and now offers interchangeable **2D map** and **3D landscape** presentations during every battle. The original 2D view is still the default and fallback.

GitHub fork: https://github.com/jonasjancarik/hussite-wars-threejs. The original project remains available through the `upstream` remote.

## Run the campaign

Serve the repository root and open `index.html`. Start any scenario, then use **2D map** or **3D landscape** in the map toolbar. Both presentations read the same live `Game` instance and issue the same commands; switching does not reload the scenario or replace the rules engine.

```sh
python3 -m http.server 8082 --bind 0.0.0.0
```

The 3D renderer bundle is committed for the static campaign and built from `experiments/sudomer-diorama/web/hex-three/src/`. Rebuild it with:

```sh
npm --prefix experiments/sudomer-diorama/web/hex-three ci
npm --prefix experiments/sudomer-diorama/web/hex-three run build
```

## Run the retained diorama page

Requires Node.js 22.18 or newer, npm, and Python 3. No Rust toolchain is needed for the Three.js scene.

```sh
cd experiments/sudomer-diorama
npm --prefix web/hex-three ci
./scripts/build_sudomer_hex_three.sh
python3 -m http.server 8082 --bind 0.0.0.0 --directory web/dist
```

Open `http://localhost:8082/sudomer-hex.html`. Select a Hussite unit, then use highlighted cells and the action panel. Drag to orbit, middle-drag or use two fingers to pan, and scroll to zoom toward the cursor. Reset camera restores the opening view. Hover highlights cells even with the grid hidden.

The separate Sudoměř page is retained as a renderer study and compatibility fixture.

## Validate

From `experiments/sudomer-diorama/`:

```sh
npm --prefix web/hex-three test
npm --prefix web/hex-three run build
node scripts/hex-diorama/test-reference.cjs
node scripts/hex-diorama/test-bridge.cjs
```

The reference comparison checks the root JavaScript rules against upstream revision `dbdf61907212476cda816ff2036a9a8d41bf3572`. The retained standalone diorama vendors that revision with a documented storage-key compatibility patch. The integrated campaign view does not use that vendor copy: it consumes the root campaign's live map, units, selection, legal actions and events. Prior Bevy experiments and their sources are retained; generated Wasm bundles, local captures and dependencies are excluded.

The diorama's README, design QA, and `web/hex-three/THIRD_PARTY_NOTICES.md` document assets and implementation. Integrated terrain is deterministic per scenario, keeps every gameplay terrain type distinct, and uses protected cell cores plus seeded continuous transitions. Automated sampling covers all 18 campaign scenarios. Camera far distance and the atmospheric veil now scale together, and the ambient fill is reduced to avoid the washed-out prototype lighting.

## Upstream updates

The original remote is named `upstream`; `origin` is the public fork. Review upstream changes before merging because the diorama's rules-parity test pins a specific revision. Original deployment settings are inherited as historical source; this fork has not been deployed to GitHub Pages or the upstream domain.
