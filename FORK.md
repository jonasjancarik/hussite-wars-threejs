# Hussite Wars — Three.js diorama fork

This development fork preserves the history and MIT license of [josefslerka/husitske-valky](https://github.com/josefslerka/husitske-valky). The original campaign remains at the repository root. A separate playable Sudoměř scene lives in `experiments/sudomer-diorama/`.

GitHub fork: https://github.com/jonasjancarik/hussite-wars-threejs. The original project remains available through the `upstream` remote.

## Run the diorama

Requires Node.js 22.18 or newer, npm, and Python 3. No Rust toolchain is needed for the Three.js scene.

```sh
cd experiments/sudomer-diorama
npm --prefix web/hex-three ci
./scripts/build_sudomer_hex_three.sh
python3 -m http.server 8082 --bind 0.0.0.0 --directory web/dist
```

Open `http://localhost:8082/sudomer-hex.html`. Select a Hussite unit, then use highlighted cells and the action panel. Drag to orbit, middle-drag or use two fingers to pan, and scroll to zoom toward the cursor. Reset camera restores the opening view. Hover highlights cells even with the grid hidden.

For the original campaign, serve the repository root on a separate port and open `index.html`.

## Validate

From `experiments/sudomer-diorama/`:

```sh
npm --prefix web/hex-three test
npm --prefix web/hex-three run build
node scripts/hex-diorama/test-reference.cjs
node scripts/hex-diorama/test-bridge.cjs
```

The reference comparison checks the root JavaScript rules against upstream revision `dbdf61907212476cda816ff2036a9a8d41bf3572`. The diorama vendors that revision with a documented storage-key compatibility patch. It does not yet replace the campaign renderer or support every campaign scenario. Prior Bevy experiments and their sources are retained; generated Wasm bundles, local captures, dependencies and build output are excluded.

The diorama's README, design QA, and `web/hex-three/THIRD_PARTY_NOTICES.md` document assets and implementation. The recent washed-out lighting and far-camera clipping findings remain open; cursor zoom is enabled in this revision.

## Upstream updates

The original remote is named `upstream`; `origin` is the public fork. Review upstream changes before merging because the diorama's rules-parity test pins a specific revision. Original deployment settings are inherited as historical source; this fork has not been deployed to GitHub Pages or the upstream domain.
