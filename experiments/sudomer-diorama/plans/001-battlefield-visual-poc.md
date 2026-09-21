# Hussite battlefield visual POC

`read_when`: implementing or evaluating the first battlefield prototype.

Status: Bevy POC implemented 2026-09-19; further art refinement remains possible. Priority P1; effort L; medium technical risk, substantial asset-quality risk. No prerequisite implementation plans.

## Objective

Build a Bevy scene that closely matches the supplied concept at its reference camera, remains convincing while panning and orbiting, and plays a short cavalry approach / handgun volley sequence. Validate the native build first, then validate a browser/WASM build. Demonstrate the same visual treatment on real battlefield elevation after a specific battlefield crop is selected. This is a visual POC with minimal interaction, not a complete RTS.

Working directory: `/Users/janca/projects/battle-game`. This directory currently contains the conversation and image and is not a Git repository. The sources are:

- `Hussite RTS Gameplay Ideas (2026-09-19) - PrintToPDF.html`: 24-message conversation. It explores formations, morale, wagon defences, miniature styling, Three.js versus Bevy, and ultimately larger landscapes based on real terrain.
- `ChatGPT Image Sep 19, 2026, 10_29_07 PM.png`: authoritative visual reference, 1672 × 941 pixels.
- `/Users/janca/projects/procedural-worlds`: reusable look and rendering examples, inspected at HEAD `c491a0a` with uncommitted changes. In particular, `scene.ts` and `performance.ts` are dirty. Never reset, modify, or silently absorb those unrelated edits.

The image is a visual target, not evidence of a particular historical battlefield or accurate equipment. The user explicitly selected Bevy for this implementation; that decision supersedes the earlier Three.js recommendation.

## Technical choice

Use Rust 1.95.0 and stable Bevy 0.19.1. Pin the repository toolchain without changing the machine's global Rust default. Build the native macOS application first so iteration, screenshot capture and GPU diagnostics are dependable; then compile the same app for `wasm32-unknown-unknown` and serve it through a minimal static web shell. Browser support is a capability to validate, not something inferred from a successful native build.

Use Bevy ECS directly for scenario state, camera controls, formations and effects. Load Blender-authored GLB assets through Bevy's glTF support. Keep terrain generation, deterministic placements, animation state and rendering setup in separate plugins/modules, but do not build a general engine abstraction. The source concept's Three/TSL rendering cannot be copied; its useful visual language—faceted foliage, muted palette, stable camera comparisons and restrained atmospheric depth—must be recreated with Bevy materials, lighting, fog and post-processing.

Bevy 0.19.1 requires Rust 1.95.0. Consult its installed examples for current APIs, including renamed shadow settings, rather than using older Bevy snippets. Prefer stable built-in rendering features and small local shaders only where the reference comparison demonstrates a clear need.

## What to borrow

All paths in this table are relative to `/Users/janca/projects/procedural-worlds/`.

| Source | Useful part | Adaptation |
|---|---|---|
| `web/src/world/canopy-geometry.ts`, `cypress-geometry.ts`, `facet-wear.ts`, `mesh-data.ts` | Faceted, subtly worn tree crowns | Keep the geometry language; create a small reusable tree kit |
| `web/src/world/vegetation.ts` | `createTreeAssembly`, `createShrubAssembly`, `createBoulderCluster` | Generate a handful of variants once, merge by material, instance by terrain chunk |
| `web/src/dev/three-mesh-data.ts` | Mesh topology conventions | Translate only the geometry ideas into Bevy `Mesh`; do not copy the Three adapter |
| `web/src/world/tsl-render-pipeline.ts` | AO, grading, antialiasing and focus treatment | Visual reference only; recreate a small Bevy pipeline without its TSL dependency graph |
| `web/src/world/static-batching.ts` | Resource ownership and reuse patterns | Apply the principle through Bevy assets, repeated scenes and instancing where measured |
| `web/src/world/three-camera.ts`, `camera-bookmarks.ts` | Reproducible camera poses | Store a new terrain-aware Bevy RTS camera and deterministic reference bookmark |
| `web/src/world/three-chimney-smoke.ts` | Simple deterministic puff motion | Motion reference only; gun smoke needs softer silhouettes and a pooled renderer |
| `docs/concept-comparison.md` | Fixed camera/time comparison workflow | Reuse the practice, with this project's target image |

For orientation, the existing tree factory is `createTreeAssembly(placement, materials, season = "summer"): SwayableVegetation`; its materials include trunk, birch, leaves, soil, litter and rocks. Its dependencies include town placement types. Recreate a small local placement component and procedural/Blender vegetation kit rather than importing the town model or TypeScript geometry stack.

Do not reuse island generation, town grids, building editing, autosaves, road placement rules or the main `TownRenderer` wholesale. The source camera starts with `PerspectiveCamera(42, 1, 0.1, 360)` and its sun shadow camera spans roughly ±42 world units. Neither setting transfers unchanged to a kilometre-scale landscape. Source foliage placement also assumes island edges; reuse its assets, not its distribution.

Read the source project's AGENTS.md when taking code. Inspect the dependency closure and record copied files/revision and any texture provenance. Prefer committed source via a staged copy; compare dirty files before taking any code from them. No runtime imports or symlinks into the sibling project. Keep all implementation in this project; no shared-engine extraction.

## Art direction and reference composition

The main visual ingredients, in priority order:

1. A low, oblique perspective across continuous rolling countryside. The land fills the frame; there is no island edge or dominant sky.
2. The diagonal wagon wall runs from left-middle toward upper-middle; cavalry approaches from the lower-right. The village and church occupy the upper-left.
3. Foreground trees, a stream and stone bridge create depth; a golden enclosed field separates foreground and battle. Distant woods and ridges fade into warm grey haze.
4. Olive, ochre, dusty tan, warm plaster and muted red roofs dominate. Red chalice banners and small heraldic accents carry the strongest saturation.
5. Trees have broad readable facets, but the ground has softly varying colour and fine surface detail. Do not turn the terrain into giant brightly contrasting triangles.
6. Wagons have visible plank divisions, spoked wheels, iron fittings, stakes and occupants. Infantry have helmets, tunics, shields and long weapons. Horses have recognizable anatomy and poses.
7. Warm directional light, restrained contact shading, soft cast shadows, modest atmospheric depth and limited focus blur unify the scene.

Start with a perspective FOV of 30–38 degrees and a downward viewing angle around 25–35 degrees, then tune against the image. These are starting guesses, not camera measurements. Save position, target, projection, sun, exposure, haze and time in one preset. Do not use strong tilt-shift blur to hide weak assets: the wagon line and attackers are readable in the reference.

The existing game's archived close-view capture is substantially softer and simpler than this reference. Borrowing its shader settings verbatim will not be sufficient.

## Scope and content budget

One small asset kit, reused carefully:

- 4–6 broadleaf variants, 2 narrow conifers, shrubs and 3 rock clusters; olive/gold colour families.
- 3 farmhouse forms and 1 church; roof, door and plaster variations; approximately 6–10 village buildings.
- 1 detailed war wagon with 2 dressing variants, deployed in a line of roughly 10–14 wagons; stakes, fences, stone walls, bridge and banner poles.
- 3 infantry silhouettes: polearm, shield/crossbow and handgun. Clothing/helmet variants may share meshes and textures.
- 1 properly proportioned rigged horse, a mounted rider and equipment variants.
- Approximately 200–300 visible infantry and 40–60 mounted figures initially; scale only after the composition works. Do not start with 5,000 troops.

The conversation discussed a later target of 500–2,000 visible soldiers and a possible 1,000-infantry vertical slice. The smaller initial count above is an intentional POC reduction so camera, terrain, wagon and horse quality can be judged before scale is increased; it is not a new engine limit.

Use scripted Blender modelling for architectural and wagon assets where useful, exporting GLB with predictable scale, pivots, material slots and mesh names. Soldiers and especially horses need an explicit silhouette and animation review. A vetted compatible asset is acceptable if its licence and style fit; this plan does not select or authorize buying an asset pack. Coding-agent output still needs visual iteration. Primitive placeholder people and box horses are allowed only during blocking.

Use shared matte materials and small coherent texture atlases: plaster variation, restrained wood grain, cloth, dirt and grass. Image generation could supply individual texture inputs if useful; do not use the full concept image as a terrain texture or camera-facing scene substitute. Preserve actual 3D geometry and parallax.

## Terrain: separate art matching from geographic evidence

Keep two scene fixtures using the same renderer and assets:

- **Reference composition:** art-directed rolling terrain arranged to match the PNG. This provides a stable visual comparison and must be labelled as an illustrative scene.
- **Real-terrain proof:** a crop of one selected Hussite battlefield, preserving its identifiable landforms. Select the location after inspecting candidate elevation; do not claim the generated picture depicts that location. Exact battlefield selection remains a content decision.

This small second fixture is necessary because a real location may not contain the image's particular combination of village, stream, ridge and bridge. Do not secretly reshape a named battlefield into the picture. Keep authored historical land use and visual exaggeration separate from source elevation.

For the real fixture, use ČÚZK DMR 5G. The official catalogue lists LAZ downloads in S-JTSK and ETRS89/TM33N: https://atom.cuzk.gov.cz/. The service describes the terrain model at https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer. Check the selected dataset's terms and preserve attribution; the Atom portal currently displays CC BY 4.0. Download and process offline, not during browser startup.

Suggested pipeline: crop roughly 1–2 km across → rasterize/resample to 2–5 m spacing → smooth only irrelevant microrelief → subtract a local origin → produce height data and chunk meshes. Use metre-based x/z and upward y; record CRS, source extent, height datum, resolution, origin and transforms. Begin at 1× horizontal/vertical scale, allowing an explicit 1.2–1.5× relief option. Modern terrain is not a reconstruction of 15th-century roads, vegetation or settlement.

Use a shared `heightAt(x,z)` and slope sampler for placement, camera clearance and movement. Add broader, coarser terrain outside the engagement area so the camera never reveals a cut edge. Surface layers comprise meadow, soil, track and crop masks, with low-frequency colour variation and restrained fine detail. Roads are terrain-conforming ribbons; field edges, fences and tree clusters are authored splines/polygons. Stream water follows a downhill course with banks; avoid a tilted flat plane passing through hills. Placement must exclude roads, water and the wagon line.

## Implementation sequence

### 1. Establish the reference shot

Create a Rust crate with a minimal Bevy scene, camera controls and a deterministic capture preset. Suggested modules: `src/render/lighting.rs`, `camera.rs`, `src/scenarios/reference.rs`, `src/terrain/`, `src/assets/` and `src/main.rs`. Keep systems focused, use typed resources/components, and avoid concentrating the whole scene in `main.rs`.

Implement the reference terrain silhouette and block village, wagon wall, stream, field and troop masses. Fix the reference camera before detailing. Include a scene-only capture mode and fixed animation time.

Verify: establish `cargo check`, targeted tests and a native release build. Capture a deterministic 1672 × 941 frame at a fixed seed/time. Inspect the main landmark positions against the PNG. A rough monochrome frame should already have the same composition. Save it before moving on.

### 2. Finish the empty landscape

Add `src/terrain/heightfield.rs`, `mesh.rs`, `surface.rs`, `src/assets/vegetation.rs`, `village.rs`, `props.rs`, and the minimal Bevy post-processing configuration. Add real-terrain preprocessing under `tools/terrain/` with uv if Python is used; choose dependencies only after checking available runtimes and current maintenance.

Implement textured colour variation, trees in clusters, field stubble, church/village, walls, track, stream and bridge. Prioritize the reference-facing surfaces, then inspect the reverse view. Begin with one sun, hemisphere fill and AO. Tune shadows for the active camera region; do not spread one small shadow map across the entire landscape. Keep distant trees inexpensive and instance by spatial chunk so they can be culled.

Verify: check/build, tests for terrain sampling and coordinate transforms, three camera views (reference, closer, reverse), and—once a real location is selected—a source-elevation preview beside that fixture. Review landform, palette, shadows and depth with troops hidden. If the landscape does not resemble the image, fix it before adding the army.

### 3. Finish one wagon and one figure of each kind

Create `blender/`, `assets/models/`, `src/assets/wagons.rs` and `units.rs` as needed. Blender is a real production stage: retain deterministic scripts, editable `.blend` sources, GLB exports and rendered previews. Produce an in-engine asset inspection view under the final scene lighting. Show the wagon, infantryman and mounted rider both close up and at reference-camera size.

Verify: silhouette, proportions, materials, pivots, grounding, missing texture errors and visual readability in the browser. A wagon must read as a crewed wooden defensive vehicle, not an open rectangular box. Approve a stationary horse and a walk/gallop loop visually before multiplying it. This is the highest asset risk; adding hundreds of poor instances makes the result worse.

### 4. Populate and animate a battle vignette

Add `src/render/formations.rs`, `effects.rs`, `src/sim/formation.rs` and `vignette.rs`. Use deterministic formation slots with mild per-soldier variation. Keep one simulation record per formation. Trees, static wagons, props and static posed troops reuse mesh/material handles and use Bevy's practical batching/instancing path. Reused meshes do not automatically provide cheap independent skeletal animation.

For the first moving slice, animate a limited foreground group with shared glTF clips and staggered starts where Bevy's animation system permits; keep more distant troops on inexpensive pose/rigid-part animation. Do not design an unproven GPU animation system before the horse animation looks good. Include animated geometry in shadows and use conservative bounds so limbs and riders do not disappear during culling.

Play a repeatable 20–30 second sequence: riders approach, infantry advance, a wagon section fires, smoke drifts, and some attackers recoil/turn. Add restrained dust near moving feet, wind-driven banners and sparse firing flashes. Use pooled soft smoke particles with controlled overdraw rather than thousands of separate emitters. Horse feet and infantry placement must follow terrain; bodies stay upright on reasonable slopes, with severe slopes excluded.

Verify: inspect paused keyframes and a running loop, then reset/replay repeatedly. Check sliding feet, synchronized animation, hovering figures, missing shadows, particle sorting and resource accumulation. Export stills at the same preset time.

### 5. Add minimal control and close the visual gap

Add selection for one formation, right-click movement on terrain, pause/play, reset and a reference-camera button. Use a small slope/obstacle grid for a simple valid route; wagons, deep water and buildings remain impassable. Selection should be hidden in scene-only captures. No full combat model is required; the vignette remains explicitly scripted.

Compare reference and render side by side after every material/lighting change. Correct camera and landmark scale first, then colour/value distribution, silhouettes, terrain/asset detail, and effects. Verify the same look on the real-terrain fixture. Keep the HUD quiet and hideable.

Verify: movement test around a wagon obstacle, deterministic reset test, native interaction, `cargo check`, tests and release build. Then compile and run the WASM target in the integrated browser; report visual and performance differences instead of assuming parity. Record frame-time data for the stationary shot, camera pan, moving troops and peak smoke on a named device/backend. Repeated reset must not show continuing entity/asset-count growth.

## Performance targets and verification limits

Initial target: comfortable 1080p desktop play, aiming at 60 fps on the actual development machine, with a documented lower quality mode if necessary. Measure p50/p95 frame times and stutters after warmup; a target is not a proven result. Record viewport, DPR, quality, device, browser and backend. Avoid a universal FPS promise or a soldier-count benchmark without shadows and particles enabled.

Use a camera-local shadow region and explicit dynamic updates for moving troops; the source game's mostly static shadow invalidation strategy cannot simply be retained. Cap pixel ratio intentionally for the test, instance vegetation spatially, limit transparent particles, reuse buffers and dispose resources on reset. Introduce further LOD or GPU animation only in response to evidence.

Establish equivalent Rust checks here: formatting, `cargo check`, targeted unit tests and a release build. Useful tests cover heightfield interpolation/edges, deterministic placement, formation obstacles and reset cleanup. Code tests cannot establish similarity to concept art; native and browser image review are required.

No source tests or benchmarks were run during planning. No live FPS, current render quality or compatibility is claimed from the archived gallery image.

## Completion criteria

- Reference-size screenshot and closer/reverse views are saved with the scene seed, camera and capture time.
- All major reference landmarks and the diagonal confrontation are recognizable at thumbnail size; detailed views hold up without heavy blur.
- Troops and horses have finished silhouettes; the scene contains the intended wagon line, cavalry, banners, smoke and dust.
- Landscape continues beyond the battle and has visible atmosphere and coherent ground detail.
- One sourced real-elevation fixture uses the same style, with documented transforms and invented land-use elements.
- Orbit/pan/zoom, simple formation orders, pause and reset work; the vignette is reproducible.
- Formatting/check/tests/release build pass; native and WASM observations are reported accurately, with recorded performance and reset checks.
- Changes stay within `battle-game`; the sibling project remains untouched.

## Decisions, estimates and exclusions

Suggested planning allowance: roughly 6–10 focused working days for the visual scene and another 2–4 for animation, minimal interaction and tuning, assuming usable modelling/animation inputs. Custom horse/character art can extend this substantially. Agent coding speed does not remove the need for visual reviews; these are estimates, not a delivery commitment.

Exclude campaigns, multiplayer, economy, historical battle reconstruction, full morale/charge simulation, per-soldier AI, unrestricted wagon deployment, mobile optimization and a general map editor. Once the visual POC passes, choose the first actual battle and implement one tactical encounter around wagons, cavalry momentum and morale.

If real terrain conflicts with the reference composition, retain separate fixtures instead of mislabelling invented terrain. If asset quality stalls, surface the specific missing model/animation rather than substituting permanent placeholders. If animation misses the target, profile before changing engines. Source-copy drift or a large dependency chain calls for a smaller local adaptation, not changes to Quiet Blocks. No branch change, push or deployment is included in this plan.
