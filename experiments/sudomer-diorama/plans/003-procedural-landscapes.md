# Procedural landscapes

`read_when`: changing map generation, geographic imports, terrain materials, vegetation placement, settlement generation, historical overrides, or terrain gameplay integration.

Status: proposed implementation plan. The Sudoměř prototype demonstrates parts of this approach; the reusable generator is not implemented.

## Aim

Generate attractive, usable battle landscapes from geographic data and a small set of artistic rules. A new location should require source data and configuration, rather than another terrain renderer or hundreds of hand-placed objects.

The intended input is **location and extent, historical adjustments, visual style, and random seed**. The output is a reproducible map package that the game can load without contacting external services or running image generation.

Procedural generation should preserve the quality of a deliberately composed scene. Success means convincing woodland, fields, shores, and settlements at both the overview and normal play distance—not merely filling every eligible area with objects.

## Starting point

The current prototype already has useful components:

- ČÚZK elevation and OSM geometry are aligned in a shared projected coordinate system.
- An offline Python script produces map data, field directions, shoreline proximity, and polygon surfaces.
- Rust places vegetation with repeatable randomness and renders distinct ground, water, and mud treatments.
- A separate script generates reusable tree and shrub models.
- Image generation supplies an art reference and reusable ground textures.

These pieces remain specific to Sudoměř. Source paths, extents, dimensions, pond handling, seeds, and some scenery placements are embedded in code. The village houses and wagon line are explicitly positioned. The historical reference guides interpretation but does not establish exact medieval land use. The root scene is currently a landscape viewer; it has no integrated combat or pathfinding yet. The previous root prototype remains at `/battlefield-study.html` for reference.

Relevant starting files are `tools/terrain/prepare_sudomer_landscape.py`, `src/sudomer/`, `src/bin/real_terrain.rs`, `blender/build_sudomer_trees.py`, and `assets/terrain/sudomer/README.md`. Keep the existing playable battlefield and diorama available for comparison during the work.

## Proposed structure

Separate the location, the visual style, and the generation rules.

| Part | Contains |
|---|---|
| Location definition | Geographic extent, source files, coordinate system, units, scenario date or period, and references |
| Historical adjustments | Explicit changes to water state, land cover, roads, or settlements, with source and uncertainty notes |
| Style definition | Asset library, palette, material scales, vegetation density and variation, lighting, and rendering budgets |
| Generator | Reusable rules that interpret the data and produce terrain, surface regions, scenery placements, and gameplay annotations |
| Generated map package | Versioned manifest, compiled geometry and masks, stable object placements, attribution, and generation metadata |

Use ordinary configuration files and the existing Python/Rust toolchain initially. Choose the simplest format that both sides can validate; do not introduce a separate editor, service, or plugin framework for this first version.

### Geographic foundation

Retain source downloads and their provenance. Perform coordinate conversion, clipping, polygon repair or rejection, and expensive spatial calculations offline. Use the actual elevation output extent, since a requested geographic rectangle may not match the returned projected raster.

The package must record metres per scene unit and relief exaggeration separately. Use the agreed metric convention: one scene unit equals one metre, with 1× elevation. Wagons, people and buildings use physical model dimensions; tree models are generated at plausible metre heights. Readability should come from camera controls and selection aids, not silent object enlargement. This convention is now applied to the Sudoměř viewer; preserve it when extracting the generator. Validate coverage, missing elevation, polygon holes, incomplete relations, and feature IDs before export. Missing or rejected features should appear in a generation report rather than silently becoming an asserted historical landscape.

OSM is a present-day starting point. Historical maps and scenario adjustments refine it; they do not turn modern geometry into proven period geography. A drained pond should be an explicit scenario override attached to a stable source feature, rather than an exception triggered by its display name in the renderer.

### Surface and scenery rules

Derive shared measurements such as slope, shoreline distance, woodland-edge distance, road clearance, and parcel direction. Let both materials and object placement use these measurements so the terrain and its dressing agree.

Woodland should have a dense interior, varied canopy heights, smaller trees at the margins, and broken shrub cover beyond them. Use a small reusable asset library with controlled variation and spacing, rather than a uniform lattice or unrestricted random scattering. Preserve the original concept’s angular, faceted tree style. Reuse the actual procedural-worlds Three.js tree generator for model exports; variation should come from its seeded silhouettes, proportions, palettes and placement rather than independently invented rounded crowns.

Shorelines should transition through water, reeds, damp soil, and grass with irregular widths. Keep the mapped bank shape separate from estimated water level and decorative planting. Field rows should follow parcel direction, with variation in crop, fallow ground, and grassy divisions appropriate to the chosen season.

Settlement generation should place plausible building groups along selected lanes and around open yards. Check rotated building footprints against water, roads, steep ground, other buildings, and the map edge. Start with a small rural settlement rule; do not attempt arbitrary town reconstruction. Important buildings can remain explicit, documented overrides.

Battle deployments, wagon lines, and objectives belong to the scenario definition. They should not be generated as decorative village or vegetation objects.

### Repeatability and art direction

The same retained inputs, configuration, generator version, asset versions, and seed must reproduce the same output. Record their versions or hashes in the package. Give each source feature and generation layer a stable random stream so changing reed density does not reshuffle the village or entire forest. Sort source features consistently before processing.

Allow small authored overrides for composition and historical interpretation. Keep them in location or scenario data, not scattered through shared rendering code. Most new maps should work with the ordinary rules; repeated manual corrections are a signal to improve those rules.

### Role of image generation

Use image generation to establish a style and create reusable materials, foliage assets where useful, and occasional layout studies. Generate and review these during authoring, then retain the selected files, prompts, and provenance.

Generated artwork should guide appearance. It must not silently move a pond, determine walkability, or replace verified geography. Avoid projecting a whole concept image containing painted trees, buildings, and shadows onto the terrain beneath separate 3D objects. A new map using an existing style should not need a new image-generation call.

### Gameplay and performance

Keep logical map properties separate from visual detail. Water, muddy ground, forest, roads, and building footprints can supply explicit traversal and obstacle annotations. The game decides their movement costs and blocking rules; texture colour alone must never decide them.

Decorative grass and most reeds should not become individual gameplay obstacles. Changing scenery density or rendering quality must not change the navigable map. Use shared meshes and materials, batch small details, and introduce distance-based simplification only where measurement shows it helps.

Integrate with the existing battlefield incrementally. This plan does not include a full pathfinder, combat rewrite, streaming world, or unlimited procedural world generation. Coordinate soldier-rendering decisions with plan 002 and measure combined terrain and troops rather than treating isolated rendering benchmarks as gameplay capacity.

## Implementation sequence

1. **Extract the Sudoměř configuration.** Move location constants, source references, drained-pond choice, style values, and explicit placements out of shared code. Keep the existing appearance as the comparison baseline. Do not redesign the visuals during this extraction.

2. **Define and validate the map package.** Add a minimal versioned manifest and a shared loader. Remove renderer assumptions about a particular raster size, square extent, or fixed pond count. Test coordinate alignment, units, polygon holes, missing-data handling, and deterministic regeneration.

3. **Generalize placement rules.** Separate vegetation, field, shoreline, and settlement generation. Add stable feature seeds and footprint clearance checks. Replace the hand-positioned village with generated placements, retaining explicit overrides where they are justified. Keep the wagon line in scenario data.

4. **Prove a second location.** Choose a nearby crop with different proportions of water, woodland, farmland, and settlement. Generate it using only new data and configuration. A source-specific importer is acceptable when needed; a forked renderer or location-specific placement code is not. Also test a different crop size or aspect ratio.

5. **Connect a generated map to play.** Load one package in the playable scene, ground formations correctly, and translate terrain orders into its coordinate system. Establish a small, explicit movement test for water and building exclusions using the existing movement system. Add broader terrain costs only as that system can support them.

6. **Tune quality and cost.** Review matched overview and close-up views of both locations, plus a shoreline, woodland edge, field transition, and village lane. Measure load time, memory, and frame times in the browser with representative troops. Set practical quality budgets from those results.

## Completion criteria

The first reusable version is complete when two locations can be regenerated and loaded through the same code, the second requires no renderer changes, and identical inputs reproduce the output. Source data and historical adjustments must remain inspectable.

Both maps must have coherent surface transitions and varied vegetation, with buildings clear of roads and water and no visible export defects. Inspect generated assets in the actual browser: valid GLB headers and triangle counts alone did not catch the earlier tree-export problems.

At least one generated map must also support the agreed small gameplay test. Visual quality settings must leave logical obstacles and traversal annotations unchanged. Record which performance targets were measured and which gameplay capabilities remain outside the implementation.

## First work item

Begin with steps 1 and 2: one explicit Sudoměř definition, one style definition, and a validated map package consumed by the existing terrain viewer. Preserve the current visual result before extending the placement rules or adding another location.
