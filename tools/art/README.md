# Art authoring

Read when regenerating models or locating their editable source.

- [blender](blender/README.md): deterministic generators, editable `source/*.blend` scenes, and `previews/` renders. Shared exports go to `assets/3d`; benchmark and experimental battle variants go to the retained experiment.
- [vegetation](vegetation/README.md): source-aware Procedural Worlds vegetation exporter and provenance checks.

These are development tools, not browser runtime dependencies. The campaign loads only the exported assets and its renderer bundle. Terrain research for the retained Bevy scenes remains under `experiments/sudomer-diorama/tools/terrain` alongside its experimental data.

The organisation change does not alter model geometry, colour, animation or gameplay mappings. See [the inventory](../../docs/MODEL_INVENTORY.md) before starting asset work.
