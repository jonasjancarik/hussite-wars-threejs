# Battlefield asset kit

The shared kit uses matte olive, ochre, tan, plaster, dark iron and red roof materials in a low-poly battlefield style. All geometry and materials are generated locally; there are no external textures or downloaded models. Settlement, camp and landscape pieces are typological scenery, not surveyed reconstructions of named sites.

## Rebuild

From the repository root, with Blender 5.2 installed:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python tools/art/blender/build_assets.py
python3 tools/art/blender/validate_exports.py
```

To rebuild selected assets, append their names after `--`:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python tools/art/blender/build_assets.py -- cavalry war_wagon
```

On this macOS machine Blender must run with native graphics-device access. Its Metal device probe crashes before Python starts inside the restricted execution sandbox. The generation itself is deterministic and requires no network or GPU compute renderer; the previews use CPU Cycles.

## Files and conventions

- `tools/art/blender/build_assets.py` is the editable, deterministic generation source.
- `tools/art/blender/source/<asset>.blend` keeps the separate named parts, procedural object animation, preview camera, ground, and lighting. These are editable Blender scenes, not flattened render-only files.
- `assets/3d/models/{units,buildings,props,vegetation}/<asset>.glb` contains the model and embedded matte materials. Preview cameras, ground, and lights are excluded. Static parts are joined by material and animated parent for efficient repeated placement.
- `tools/art/blender/previews/<asset>.png` is the rendered close-up.
- `assets/3d/models/manifest.json` records measured dimensions, triangles, export mesh count, source part count, and animations.

One unit represents approximately one metre. Blender uses Z-up and exports glTF with Y-up. The original kit and units face +X where facing matters. The fortification kit uses Blender −Y / glTF +Z as its front, with straight wall and palisade sections along X; its corner module has an elbow origin, as documented in the references. Houses and camp pieces also present their fronts along Blender −Y / glTF +Z. Functional landscape pieces—the field shelter, firing platform and bridge approach—face Blender +X and retain glTF +X. Place a scene at ground height with an identity rotation; there is no hidden global scale. Houses and vegetation are centred in their footprint; soldiers and the horse are centred around their body; the wagon is centred on its deck, so its towing poles extend further toward +X. All meshes are opaque, with small standalone banner surfaces using glTF's default double-sided material behaviour.

`cavalry.glb` contains one `HorseWalk` clip: 49 source frames at 24 fps, exactly two seconds between the first and last sample. Repeat the clip when walking. The four legs have staggered upper-leg swing and knee flexion, the body rises and pitches slightly, and the tail sways. Animation is an in-place object-transform loop, not skeletal animation or root motion; the game moves the cavalry entity. The rider travels with the horse. No attack, death, or transition clips are included.

## Included assets

| Asset | Contents |
| --- | --- |
| `war_wagon` | Four ten-spoke wheels, iron tyres and axles, separate wooden planks, fittings and rivets, defensive boards and stakes, two crew, towing poles, chalice banner |
| `cavalry` | Original faceted horse and polearm rider with walking loop, retained unchanged |
| `cavalry_light`, `cavalry_scout`, `cavalry_heavy` | Static mounted variants with distinct equipment and side-colour cloth/shields |
| `infantry_spear` | Long plain spear, kettle hat and side-colour cloth |
| `infantry_archer` | Drawn wooden bow, nocked arrow, hip quiver, cloth cap and side-colour cloth |
| `infantry_polearm`, `infantry_halberd` | Distinct sudlice/halberd heads, kettle helmets, side-colour cloth |
| `infantry_handgun` | Side-colour coat, helmet, short hand cannon and neutral ochre powder flask |
| `infantry_shield` | Side-colour coat, plain striped shield and sword for mercenaries |
| `infantry_flail` | Static flailman with iron-bound wooden striker, padded jack, kettle hat and side-colour cloth |
| `infantry_crossbow` | Static crossbowman with composite bow, tiller, stirrup, bolt case and side-colour cloth |
| `infantry_pavise` | Static bearer with tall ribbed pavise, wooden back, sword, side-colour cloth and shield paint |
| `artillery_houfnice` | Short broad field gun on a timber carriage with spoked wheels |
| `artillery_tarasnice` | Long slim field gun on a low wheeled timber bed |
| `artillery_bombard` | Heavy hoop-bound siege gun on ground timbers with stone shot |
| `artillery_gunner` | Static crew with apron, ramrod and side-colour cloth |
| `civilian_adult`, `civilian_woman`, `civilian_child` | Mixed pilgrim figures with ordinary clothes, staff and bundles |
| `commander_captain`, `commander_noble`, `commander_cleric` | Shared leader bases for all 27 commanders |
| `infantry_dismounted` | Armoured foot soldier for explicit cavalry dismounts |
| `commander_standard` | Neutral striped faction-colour standard for leaders |
| `field_blockhouse` | Fixed timber/stone garrison with two visible crossbow defenders |
| `church` | Plastered nave, buttresses, windows, red roof, bell tower, slate spire and cross |
| `farmhouse` | Timber-and-plaster walls, windows, door, chimney and red gabled roof |
| `fort_wall`, `fort_wall_corner` | Modular straight and L-shaped masonry walls with a raised wall-walk |
| `fort_gatehouse` | Open passage through a masonry gate with a roofed timber-and-plaster upper storey |
| `fort_tower_square`, `fort_tower_round` | Two compact roofed defensive tower silhouettes |
| `fort_manor` | Fortified residential keep with narrow windows and an external timber stair |
| `timber_palisade` | Pointed posts with rails and braces, in a reusable six-metre section |
| `broadleaf_olive`, `broadleaf_gold` | Faceted crowns with visible trunk and branching |
| `cypress` | Narrow layered dark-green silhouette |
| `stakes` | Three crossed timber obstacles linked by a rail |
| `banner` | Red cloth and pale Hussite chalice on wooden crossbar |
| `bridge` | Slightly arched plank deck, timber girders, posts and rails |
| Settlement batch (9) | `house_timber`, `house_plaster`, `townhouse`, `barn`, `shed`, `monastery_wing`, `church_gothic`, `fence_gate`, `well` |
| Camp batch (11) | `tent_small`, `tent_pavilion`, `baggage_cart`, `camp_barrels`, `camp_sacks`, `camp_fire`, `ammunition_pile`, `haystack`, `timber_pile`, `discarded_equipment`, `wagon_abandoned` |
| Landscape batch (8) | `rock_foundation`, `field_shelter`, `low_stone_wall`, `firing_platform`, `bridge_approach`, `ford_stones`, `reeds`, `bank_rocks` |

The village and troop detailing is intended for a stylized battlefield, not a reconstruction of a particular historical location. Small faces and hands remain deliberately simplified. There are no colliders or LOD meshes; the application supplies placement, movement, collisions, and distance visibility. Asset heights in the manifest include raised weapons, flags, roof crosses, or tree tips.

The infantry additions are defined in `infantry_batch.py`, registered by the shared generator. Their references, intentional simplifications and gameplay mappings are recorded in [infantry-references.md](infantry-references.md). They keep static poses; the campaign only recolours materials named `team_cloth` and `team_paint`. `render_infantry_batch.py` renders the exported batch together in both game-side palettes to `previews/infantry-batch.png`. Pass `-- --spear-bow` to render the spear/archer pair as `previews/spear-bow-batch.png`.

The artillery batch is defined in `artillery_batch.py`; [artillery-references.md](artillery-references.md) records its evidence, reuse choices and crew abstraction. `render_artillery_batch.py` renders the three exported guns with both crew palettes to `previews/artillery-batch.png`.

The static cavalry variants are defined in `cavalry_batch.py`. They reuse the original horse with its actions removed and standing leg transforms, then add new riders and equipment. [cavalry-references.md](cavalry-references.md) documents the period references and reuse decisions. Pass `-- --cavalry` to `render_infantry_batch.py` for the comparison render.

`people_batch.py` supplies the final civilian, commander and dismounted figures. `support_units.py` supplies the fieldwork, neutral standard and refreshed older unit models. Their references are in [people-references.md](people-references.md) and [support-unit-references.md](support-unit-references.md). Render the final roles with `render_unit_completion.py`. The full roster is deliberately mapped in `views/3d/src/unit-recipes.ts`; unknown types fail instead of silently becoming polearm infantry.

`fortification_batch.py` supplies the reusable wall, gate, tower, manor and palisade pieces. [Fortification references](fortification-references.md) records the KCD II screenshots, NPÚ historical checks, intentional simplifications and module connections. `render_fortification_batch.py` renders the exported kit to `previews/fortification-batch.png`. The environment batches are defined in `settlement_batch.py`, `camp_batch.py` and `landscape_batch.py`; their corresponding `*-references.md` files document sources and interpretation limits, and `render_settlement_batch.py`, `render_camp_batch.py` and `render_landscape_batch.py` render the exported GLBs. `build_assets.py` registers the builders and writes the export manifest; logical model paths are maintained in `assets/3d/model-paths.json`. Their pieces are used by `views/3d/src/environment-plan.ts` and `generated-scenery.ts` across the battle maps; this is a stylized typological kit, not an exact reconstruction of each named place. The Gothic church uses a 1.45 vertical display factor to keep its landmark silhouette readable within its compact footprint.

Run an individual same-scale gallery from the repository root (the scripts read exported GLBs and do not regenerate or change them):

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_settlement_batch.py
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_camp_batch.py
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_landscape_batch.py
```

Each renderer can write a private preview by appending `-- --output /tmp/<batch>-batch.png`. The checked-in gallery renders are under `tools/art/blender/previews/`; the matching `*-references.md` documents include the sources and interpretation limits. Build scripts generate source `.blend` files, exports and manifest entries; render scripts only inspect the GLBs.

## Verification

`validate_exports.py` checks GLB headers and lengths, embedded buffers, materials, mesh presence, buffer ranges, and the cavalry animation. It requires a single named gait clip, a two-second duration, matching first/last transform samples, and at least nine changing transform channels. Rendered close-ups are also inspected because data checks cannot establish a convincing silhouette.
