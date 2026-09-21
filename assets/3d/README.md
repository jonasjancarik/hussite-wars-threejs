# Shared 3D assets

Read when adding, moving or rebuilding a model, texture or authored landscape.

This is the canonical shared asset library for the supported 3D campaign view. Assets are organised by what they represent:

```text
assets/3d/
  model-paths.json       stable model IDs → relative GLB paths
  models/
    units/              soldiers, cavalry and war wagons
    buildings/          church and farmhouse
    props/              banner, bridge and stakes
    vegetation/         trees and shrubs
      sudomer/          authored vegetation set and its manifest
      procedural-worlds/ imported vegetation set and provenance manifest
    manifest.json       original kit dimensions and export metadata
  scenarios/            authored landscape manifests, starting with Sudoměř
  textures/             ground, mud, sky and source-specific texture sets
```

Source/provenance groups remain inside the vegetation family so their manifests and hashes stay with the exports. A filename's source prefix does not imply that a model is restricted to one battle. The shared catalog lets existing logical model IDs survive folder changes; add an entry when adding a runtime model. The renderer rejects unknown IDs instead of guessing a path.

Blender sources, generators and previews live in [tools/art](../../tools/art/README.md). Do not edit generated GLBs as the sole source of a change. Preserve original source credits and hashes in manifests and [third-party notices](../../views/3d/THIRD_PARTY_NOTICES.md).

The six static battle/benchmark variants remain in `experiments/sudomer-diorama/assets/models/`. They are not loaded by the campaign. Promote an experimental asset deliberately when integrating it; do not keep a second maintained production copy. The [model inventory](../../docs/MODEL_INVENTORY.md) covers both shared and experimental exports.

Legacy Bevy viewers retain their original runtime paths. `experiments/sudomer-diorama/scripts/prepare_shared_assets.py` stages ignored compatibility copies for them; Wasm build scripts invoke it automatically. These generated copies are not asset sources.

After changing assets or paths, run `npm --prefix views/3d test` and `npm --prefix views/3d run build`. Check both views in the campaign when changing loading or entrypoints.
