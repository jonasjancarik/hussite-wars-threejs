# 3D campaign view

Read when changing the Three.js presentation, asset loading, or its build.

This is a supported presentation of the same game as the [2D view](../2d/README.md). Shared rules, scenarios and battle controls remain in `js/`; `ThreeBattleMapView.js` adapts the live game to the renderer in `src/`. It does not own a second rules engine.

From the repository root:

```sh
npm --prefix views/3d ci
npm --prefix views/3d test
npm --prefix views/3d run build
```

The build typechecks TypeScript and writes `dist/`, then copies the browser bundle to tracked `integrated/hex-three.js` for the static campaign. Commit that bundle with renderer changes. Dependencies and `dist/` are ignored. No root package manager or new dependency was introduced.

Models, textures and authored scenario manifests live in [assets/3d](../../assets/3d/README.md). `model-paths.json` resolves stable model IDs to category folders; do not hardcode former experiment paths. Model generation lives in [tools/art](../../tools/art/README.md). Provenance is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and adjacent asset manifests.

Serve the repository root and use the campaign's 2D/3D buttons. The standalone page waits for its first rules snapshot before creating the renderer, since locale loading can finish after the bundle loads. The standalone Sudoměř page and Bevy comparisons remain [experimental fixtures](../../experiments/sudomer-diorama/README.md).

## Campaign behaviour

The root campaign now loads the Three.js renderer on demand through `views/3d/ThreeBattleMapView.js`. The active root `HexGrid` remains authoritative, and the same generator provides a complete fallback for every campaign scenario. Optional art manifests must validate against that live map before they can change presentation. The standalone Sudoměř page below remains a renderer fixture.

Sudoměř additionally has an authored-art manifest in `assets/3d/scenarios/sudomer-landscape.json`. Its source-terrain hash must match the active map before it can replace the generated presentation. A mismatch falls back to generated terrain, so authored scenery cannot silently drift away from gameplay.

Authored decorations retain the key of their nearest gameplay hex even after static and instanced batching. Under advanced fog, explored cells reveal their own trees, landmarks, reeds, stones, grass and flowers while decorations assigned to unexplored cells remain hidden.

Sudoměř has no rules-level field terrain. Its playable `plains` therefore remain meadow, while crop fields, buildings, woodland framing, walls and heavier stones sit in the non-playable diorama fringe. The generic renderer still treats `field`, `fields`, `farmland` and `cropland` as cultivated terrain when those values occur in a scenario snapshot. The complete 3D hex grid is visible by default and can be toggled with **Hex grid** in the map controls.

`views/3d/src/terrain-regions.ts` is renderer-neutral. It merges same-terrain neighbours, applies deterministic coherent variation at region borders and preserves a protected core inside every source cell. The test suite measures area coverage across all campaign scenarios and keeps the 75% minimum explicit.

Generator v2 adds the shared visual baseline before scenario authoring: world-scaled meadow, earth, grassy-slope and water materials, textured vertical soil sides, and semantic elevation inferred from connected hills and slopes. Meadow grass instances are currently disabled. Terrain blends ease into each protected hex interior to avoid abrupt mud-bank height jumps. The thin, muted grid meets at shared hex edges, respects unit occlusion, and omits steep segments instead of stretching across cliffs; selection and movement colors remain stronger. `performance.ts` provides resettable 240-frame captures with raw frame, preparation and renderer timings plus public Three.js counters. Vítkov is the primary visual and performance fixture; no Vítkov coordinates or scenario-name branches exist in the generator.
