# Sudoměř landscape

Read when changing the terrain scene, geography, art inputs or regeneration.

The `/` view combines the retained ČÚZK DMR 5G crop with OpenStreetMap landscape geometry, an inspected 1837 cadastral reference, and authored miniature scenery. It is now the main scene, though it remains an evolving interactive landscape rather than an exact 1420 reconstruction. The earlier playable prototype is retained at `/battlefield-study.html` as a reference.

## Current metric scene

The current renderer uses **one scene unit per metre**. Its extent is generated from the projected DMR output: 2,228.244868 m wide. Original elevation differences are rendered at **1×**, without horizontal compression or relief exaggeration. Older scale and tree experiments described below are historical implementation notes, superseded by this section.

Wagons and farmhouses now use their model dimensions at scale one. The wagon's overall length is 5.305 m, including its tow poles. Its crew are approximately 1.75 m tall to the helmet, with weapons extending higher; the figures stand on the wagon deck. The five wagons are spaced 5.6 m apart. House coordinates retain their previous geographic locations, converted into metres; model sizes are not multiplied by that conversion.

Trees are exported from the actual `procedural-worlds` Three.js assembly functions. See `tools/vegetation/README.md` and the model manifest in `assets/models/procedural-worlds/` for source provenance, deterministic export instructions and exact metre dimensions. The three nominal tree heights are 10.8, 14.2 and 17.5 m, and the shrub is 1.35 m. Runtime size variation is modest and recorded in the scenery code. Summer canopy geometry is selected for the preferred art style; this is not a claim of exact March foliage. Internal Three.js instances are baked to ordinary meshes for Bevy compatibility. The original source repository is read-only during this workflow.

Full-map objects are consequently much smaller on screen. **View wagons** (V) frames the metre-sized wagon line; **Frame scene** (F) restores the kilometre-scale overview. Orbit targets follow local terrain elevation, pan limits follow map extent, and clipping, shadows and haze follow the camera's metre-based range. Wheel and pinch remain unrestricted apart from the numerical safety minimum.

## Geography and reproduction

`osm-source.xml` was retrieved on 2026-09-20 from:

https://api.openstreetmap.org/api/0.6/map?bbox=14.048,49.230,14.080,49.255

It contains public OSM data, © OpenStreetMap contributors, available under ODbL: https://www.openstreetmap.org/copyright . The source extract is retained; no live map service is used at runtime. The earlier Overpass endpoints returned HTTP 406 and timed out; the official small-area map API provided the extract successfully.

Run `uv run tools/terrain/prepare_sudomer_landscape.py` to regenerate the compiled data from this extract. The script transforms WGS84 coordinates into EPSG:5514 and uses the **output_extent** in `../sudomer_dmr5g.json`, not the requested WGS84 rectangle, to align with the square elevation raster. Closed OSM ways and assembled multipolygons retain interior holes. Open or incomplete rings are omitted. Land use defaults to meadow where no supported polygon covers the crop.

- `landcover.rgba` is a 769 × 769 raw data raster: land class, pond ID, road mask, authored strip index. It is not display colour or transparency.
- Classes are water=1, drained basin=2, woodland=3, farmland=4, meadow=5, settlement=6.
- `pond-triangles.f32le` stores clipped vector pond surfaces, including island holes. Preprocessing checks their total area against the source polygons; this avoids square raster steps at shorelines. Shapely is used only for offline geometry preparation, not as a game runtime dependency.
- `landcover-data.png` is a lossless diagnostic copy, not an art texture.
- `layout.json` records projected geometry, named places and pond levels.
- `geographic-plan.png` is a labelled map rendered from those data and used as an image-generation reference.
- `src/sudomer/data.rs` is generated alongside the assets and embeds the raw raster for native and WASM use.

The square spans 2,228.2449 metres and 192 scene units. Vertical scale is now **192 / 2228.2449 × 1.8**, a deliberate 1.8× relief exaggeration after unit conversion. The original elevation metadata retains the old proof's 1.35 value; it describes the source fixture, not the new renderer. Source elevation bytes are unchanged. Heights are bilinearly sampled. Pond surfaces use the median source elevation inside each mapped polygon; those are rendering estimates, not surveyed water-level observations. Škaredý's surface is lowered to a damp bed. The continuous ground mesh is lowered immediately around pond edges so it remains beneath the separate vector water and mud surfaces, preventing fields from projecting through them.

## Historical interpretation and art

The inspected 1837 reference and direct source URLs are in `../historical/sources.md`. It informed the long-strip agricultural character, pond corridor, open margins and southwestern woodland. We did **not** trace cadastral parcels or establish their survival from 1420. Current OSM farmland envelopes are subdivided into illustrative strips, and current tree cover and tracks remain approximate starting points. Railways and major modern road classes are excluded; retained roads are rendered as dirt tracks without claiming a medieval date.

Škaredý is explicitly overridden to a drained muddy basin, following the battle account at https://budejovice.rozhlas.cz/k-sudomeri-se-vratil-jan-zizka-a-s-husity-opet-odolal-presile-7050176 . Other mapped ponds retain water. This is a visual interpretation, not a claim that every modern pond existed in the same form in 1420.

Sudoměř lies at the northwest edge of the square. Six period-style farmhouses represent the visible village edge; their positions are authored and checked for clearance from mapped roads and water, not copied from current building footprints. The reused kit has tiled roofs and leafy broadleaf trees, so architectural and seasonal accuracy remains approximate. Wagons form an illustrative roadblock by the memorial location; no tactical reconstruction or movement is claimed.

`../sudomer-art-study.png` was generated with the built-in image-generation tool on 2026-09-20, using `geographic-plan.png` for layout and `../../diorama/landscape-plan.png` for style. The exact prompt is in `image-prompt.txt`. The image guides the palette, field treatment and shore planting and appears in the page's Landscape study dialog. Its pixels do not determine collision, pond placement or terrain elevation, and are not projected onto the ground.

`../../textures/sudomer-pond-mud.png` was generated with the same built-in tool; `mud-prompt.txt` retains the prompt. It supplies repeating diffuse detail to the drained basin. The initial pass reused `../../textures/painted-ground.png`; the follow-up pass below replaces it with a generated meadow tile and a separate earth-grain layer. Both sources are recorded in the textures README. The engine adds ground colours, small shoots and stubble, reeds, 3D trees, farmhouses and wagons, a soil-edged plinth, filtered shadows, bloom and distance haze. The artwork's exact appearance and historical accuracy are not promised by the 3D rendering.

## Controls and checks

Right-drag or one finger orbits, left-/middle-drag or two fingers pans, pointer-relative scrolling or pinching zooms, and F / Frame scene restores the overview. P captures the native scene. The Landscape study dialog includes the generated artwork and a separately attributed 1837 reference.

`cargo test --bin real_terrain` checks data dimensions and pond IDs, named geographic sample locations, farmhouse footprint clearance, and touch gestures. `cargo build --release --target wasm32-unknown-unknown --bin real_terrain` checks the browser target; `scripts/build_wasm.sh` packages all scenes and cache-busts this page's JS and WASM. Browser rendering still needs a visual check after art changes.

## Natural surface and woodland pass

The follow-up art pass replaces the pointed trees with three broad, irregular deciduous models and a shrub, softens the lighting, and raises shadow depth/normal bias to remove the diagonal self-shadow artifacts observed across ground and water. Tree placement is still constrained by the mapped woodland and banks. Clusters of smaller shrubs and slender reed tufts fill the transition into open ground.

`surface.rgba` holds signed shoreline proximity, parcel row angle, row phase, and strip-edge phase. It is generated from the retained map data, with proximity capped at six scene units. Each farmland polygon's longest axis determines its illustrative row direction; narrow strip widths vary by parcel. These are authored interpretations, not traced 1837 field divisions. The current `geographic-plan.png` reflects this refinement; the earlier generated art study used the previous globally aligned strip layout with the same pond geography.

The meadow uses `assets/textures/sudomer-meadow.png`, generated with the built-in image tool using `meadow-prompt.txt`. A separate earth-grain layer supplies fallow fields, worn tracks and soft damp banks. Repeating ground materials use linear, 8× anisotropic sampling rather than the previous nearest filtering. Water remains a flat vector surface but has additional subdivisions for a shallow-to-deep colour transition and subtle static ripple normals. It does not simulate waves or real sky reflections.

Vegetation source and export instructions are in `blender/build_sudomer_trees.py`. Run `python3 blender/build_sudomer_trees.py` for the direct GLB path. Three trees use 924, 868 and 952 triangles, and the shrub uses 344. Export assertions reject cross-lobe triangle indices; Y-up conversion and outward winding are validated. Blender 5.2 crashed in Metal initialization on this host, so this pass uses the script's direct GLB export path; browser rendering is the visual verification. No native `.blend` preview is claimed for these assets.

## Current tree style and zoom

The original olive/gold faceted tree kit is restored by user preference. Varied planting, smaller bank vegetation, ground treatments and lighting remain; the experimental rounded models are retained as unused assets. Trees use the earlier 0.40–0.65 woodland scale with height variation, and understory uses small versions of the same angular kit.

Wheel and pinch zoom can now move past both previous 55/460 scene-unit limits. There is no map-scale maximum; a 0.05-unit numerical minimum prevents a zero-distance orbit, and invalid/overflowing input is ignored. Camera clipping adapts to distance. F still restores the overview.

Objects are not consistently at geographic scale. The 2,228.2449 m crop spans 192 scene units (11.6065 mapped metres per scene unit). The 5.305 m wagon kit at scale 0.54 occupies about 33.25 mapped metres: about 6.27× enlargement, including its crew. The terrain view contains those crew figures, not the main scene's independent soldier formations. Woodland trees in the restored kit occupy approximately 25–58 mapped metres in height. Relief independently uses 1.8× exaggeration. These choices remain illustrative pending an explicit scale policy in plan 003.
