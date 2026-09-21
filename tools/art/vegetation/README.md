# Procedural Worlds vegetation export

`export-procedural-worlds.mjs` imports the authoritative seeded assemblies from
the local Procedural Worlds checkout and exports four static GLBs for this
game. It never writes to that checkout.

Run it from the battle-game repository:

```sh
node --experimental-strip-types tools/art/vegetation/export-procedural-worlds.mjs
```

The default source checkout is `/Users/janca/projects/procedural-worlds/web`.
Set `PROCEDURAL_WORLDS_WEB_DIR` to another checkout's `web` directory when
needed. The exporter loads the generated GLB back through `GLTFLoader`, checks
finite Y-up bounds, confirms the whole asset touches ground at Y=0, and
confirms the exported triangle count matches the source assembly.
Before export, it bakes the source generator's `InstancedMesh` geometry into
ordinary merged meshes, so the GLBs do not require `EXT_mesh_gpu_instancing`
and load in Bevy.
`assets/3d/models/vegetation/procedural-worlds/manifest.json` records the exact source
revision, working-file digests for the files actually imported, generator
function, seeded variation, size, face count, exported material palette, and
output digest for each asset. Tree assemblies use the source generator's
`summer` season; their geometry is reused exactly, while this exporter supplies
the recorded static material palette.
