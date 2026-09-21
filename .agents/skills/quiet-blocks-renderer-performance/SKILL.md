---
name: quiet-blocks-renderer-performance
description: Diagnose and optimize Quiet Blocks real-time rendering performance, especially Android Chrome, Pixel-class phones, WebGPU/TSL, WebGL 2, pmndrs comparisons, slow startup, intermittent freezes, first-pan stalls, shader or pipeline compilation, frame pacing, and expensive weather, lighting, shadow, or post-processing effects. Use for block-add or automatic-growth latency, planning and cache changes, renderer regressions, quality budgets, and performance diagnostics without weakening the intended visual result.
---

# Quiet Blocks Renderer Performance

Find the measured cause before reducing visual quality. Keep each experiment reproducible, isolate one rendering cost at a time, and compare the same scene and interaction across backends.

For building edits, automatic growth, persistent object pools, or combining
performance changes, read [Edit performance](references/edit-performance.md).
It covers the current reuse patterns and the correctness checks that make
local updates safe. Commands and recorded results live in
[the performance guide](../../../docs/web-performance.md); historical timings
are evidence for their recorded configuration, not universal performance limits.

## Establish one comparable run

1. Inspect `git status` and preserve unrelated work.
2. Identify the actual server port, owning process, and checkout before changing or restarting the app. Do not assume another worktree's server serves your source.
3. Record the commit, device, Chrome version, backend, benchmark, quality, render stage, viewport, effective pixel ratio, pacing, GPU timestamp setting, battery level, and thermal status.
4. Separate these cases instead of treating them as one result:
   - cold page and renderer startup
   - scene construction and pipeline warm-up
   - the first deterministic camera movement
   - stationary steady-state animation
   - repeated movement after warm-up
5. Reproduce the player's report at its original quality and effects before using an empty scene, lower tier, or stripped render stage. Treat simplified scenes as ablations, not proof that the reported configuration is healthy.

Start with these files:

| Concern | Start with |
| --- | --- |
| Frame metrics and quality budgets | `web/src/world/performance.ts` |
| Capture events and renderer stalls | `web/src/world/profiling.ts` |
| Backend and render-stage selection | `web/src/world/renderer-backend.ts`, `web/src/world/tsl-render-stage.ts` |
| Render loop and scene readiness | `web/src/world/scene.ts`, `web/src/main.ts` |
| Weather, lights, and environment animation | `web/src/world/environment.ts`, `web/src/world/atmosphere.ts` |
| Desktop and Android capture runners | `web/scripts/profile-chrome.ts`, `web/scripts/profile-android.sh` |
| Persistent props and façade instances | `web/src/world/three-resolved-props.ts`, `web/src/world/three-facade-details.ts` |
| Vegetation identity and staged activation | `web/src/world/vegetation-reconciliation.ts`, `web/src/world/environment.ts` |
| Incremental semantic planning | `web/src/world/resolved-world-plan-cache.ts` |
| Growth search and CPU benchmark | `web/src/world/town-growth.ts`, `web/scripts/benchmark-town-growth.ts` |

Keep benchmark routes deterministic and development-only. Do not let them alter normal persistence or production defaults.

## Measure the interaction that stalls

Use the Android runner from `web/`:

```bash
npm run profile:android -- --paced --renderer=webgpu close-rainy-dusk high full 30
```

Use `--renderer=webgl2` or `--renderer=pmndrs` only for a same-scene comparison. Prefer a thermally clean run; reserve `--force` for exploratory evidence and do not compare a forced hot run with a cool baseline.

For first-pan reports, use a repeatable camera trajectory and mark its start and end in the profile. A stationary paced capture cannot validate interaction smoothness. If no deterministic movement fixture exists, add the smallest development-only fixture that reproduces the gesture before optimizing.

Run cold and warm cases separately. Avoid repeated captures when battery or temperature changes enough to invalidate the comparison.
Use a cool device for controlled A/B attribution, then repeat the winning
candidate at a representative moderate temperature and load. A cold-only pass
does not establish real-use smoothness; compare cool runs with cool baselines
and warm runs with warm baselines instead of mixing the two.

If the same edit freeze reproduces on desktop, use the local browser for faster
profiling and iteration. Still validate the final candidate on the reported
phone because pipeline compilation, buffer upload, pacing, and thermal costs can
have different magnitudes there.

## Attribute time before changing the scene

Read the metrics as distinct signals:

- A long `frameMs` with a short `rendererMs` is a frame gap, not evidence that the renderer call itself stalled.
- A large `preparationMs` points to scene updates, rebuilding, batching, or main-thread work before the renderer.
- A large `rendererMs` points to work or synchronization inside the renderer call, including possible lazy pipeline compilation.
- GPU timestamps, when supported and measured without destabilizing the run, help separate submitted GPU work from CPU-side renderer time.
- Changes in program, geometry, texture, draw-call, or triangle counts around a stall provide context; none alone proves causality.
- A slow renderer call can create the large `frameMs` recorded on the following
  frame. Inspect adjacent frames and the preceding mutation rather than
  requiring both maxima to share one timestamp.
- Per-object program diagnostics observe global renderer counters. If a counter
  changes while an internal fullscreen `Render Pipeline` object is being
  processed, that is correlation rather than proof that the fullscreen pass
  caused the compile. Check the material, attributes, resource-count deltas,
  and the scene mutation that preceded it.

Use a browser or Android performance trace when the in-app profile cannot explain where a gap occurs. Preserve exact event times so renderer data and the trace can be correlated.

Read the saved profile after capture completes. The live HUD can miss a stall
that lands near the end of its rolling window or before the automatic export
finishes. Treat the exported JSON as the source of truth for pass/fail
thresholds.

## Isolate one rendering cost at a time

Hold the camera path, quality, effective pixel ratio, and pacing constant while changing one factor. Prefer the existing render stages and feature controls before adding new instrumentation.

Test likely costs independently:

- rain and precipitation animation
- mist banks, aerial perspective, and light shafts
- depth of field, bloom, ambient occlusion, and other post-processing
- shadow maps and shadow refreshes
- streetlight count and affected materials
- vegetation animation and objects excluded from static batches
- material and shader-program variation

Compare WebGPU/TSL, TSL WebGL 2, and pmndrs only after confirming that each run has the same scene, effects, pixel load, pacing, and camera movement.

## Preserve stable renderer layouts

Treat changes to realtime light count, scene membership, material defines, clipping, shadows, and other compile-time features as possible shader or pipeline-layout changes.

- Keep runtime light roles and counts stable within a quality tier. For intermittent effects, prefer a fixed pool whose existing members change intensity, transform, or target.
- Do not repeatedly toggle a light or material variant into and out of the renderer layout merely to represent a flicker.
- Allow an explicit scene rebuild or quality change to establish a different stable layout.
- Add a focused regression test for the invariant when the decision can be expressed outside Three.js internals.
- Verify the transition itself. A smooth interval before or after the effect does not prove the transition is safe.

Consider pipeline prewarming only after evidence identifies lazy first-view compilation. Measure startup and readiness afterward; do not hide a panning freeze by moving the same multi-second block in front of the first interaction.

## Stage edit-driven environment changes across rendered frames

A fast JavaScript rebuild does not prove an edit is smooth. Three.js may create,
upload, retire, or synchronize renderer resources only on the first renderer
submission after the scene graph changes. Profile both the rebuild event and
the following rendered frames.

When a town edit changes roads, island bounds, vegetation, dressing, or props:

- Distinguish logical plan generation from renderer mutation. The world-plan
  cache can reuse unaffected building components and proven-safe world sections,
  while some placement resolution remains global. Report which work was reused
  instead of calling every stage incremental.
- Treat both removal and insertion as expensive. Disposing or detaching a
  large batch can stall the next renderer call even when the replacement is
  still hidden.
- Keep reusable `InstancedMesh` objects attached to the same parent. Reusing the
  JavaScript object after `removeFromParent()` is not persistent renderer
  identity. Update count and matrices in place and reserve enough capacity to
  avoid threshold-driven replacement.
- Preserve `BufferGeometry`, `BufferAttribute`, and typed-array identities for
  fixed-topology terrain and route geometry. Copy new values into existing
  arrays and mark them dirty; replacing the mesh alone is insufficient if the
  geometry or GPU buffer is recreated.
- Bound large mixed-geometry `BatchedMesh` objects. Several smaller stable
  batches can trade a few draw calls for much lower worst-frame upload and
  retirement cost.
- Choose chunk size by A/B measurement. Smaller chunks reduce one mutation but
  can worsen the tail by multiplying renderer submissions, shadow refreshes,
  and synchronization points. Compare worst frame, p99, total catch-up time,
  and steady draw calls before keeping a finer partition.
- Give each chunk or renderer subsystem a semantic signature and skip no-op
  stages. For example, puddles and ripples should not rebuild when an edit did
  not change any road or parking surface.
- Schedule the next mutation only after an actual render completed. A plain
  `requestAnimationFrame` chain is insufficient because frame pacing or idle
  rendering can run several callbacks between renderer submissions.
- Weight a staged object by descendant render work, not by top-level
  `Object3D` count. One tree group may contain several instanced or batched
  meshes and must receive its own frame.
- Let rapid edits cancel obsolete stages while keeping the environment dirty.
  After input settles, the newest requested plan must run to completion.
- Record prepare, remove, rebuild, and reveal stages separately. Correlate a
  renderer stall with the mutation from the preceding rendered frame, because
  the next stage may be recorded at nearly the same timestamp after rendering
  completes.
- Keep synchronous `prepare` renderer-neutral. Regenerating logical seeds is
  acceptable there; rewriting rain, snow, terrain, or instance buffers is not.
  When a footprint truly changes, split independent large-buffer updates into
  separate rendered stages and do not update disabled precipitation variants
  in the same submission.

Use the development-only `benchmarkEdit=add-buildings` route to exercise
repeated isolated ground-level edits. Compare renderer stalls, frame gaps,
worst frame, settled draw calls, program count, and stable realtime-light count.
The target is not merely to move one freeze into a sequence of noticeable
micro-stutters.

Historical A/B testing or `git bisect` is useful only after proving a genuinely
good revision with the same scene, pixel load, backend, and deterministic edit
route. A remembered smooth version under a different draw-call count or scene
composition is not a valid good boundary.

## Diagnose screen-locked bands before editing textures

If horizontal stripes remain in the same screen position while the camera pans,
treat them as a screen-space rendering artifact until an A/B test proves
otherwise. Hold one close camera view and remove one stage at a time:

1. Toggle the construction grid.
2. Replace the ground map with a flat placeholder.
3. Disable shadows, fog, mist, and depth of field independently.
4. Disable GTAO, then compare the `scene` diagnostic stage with the full graph.
5. Exaggerate output dither only to distinguish quantization from an upstream
   pass; visible noise that leaves the stripes intact is not a dither fix.

Do not call the artifact fixed from a distant or downscaled screenshot. Restore
every user-facing setting and source texture after each diagnostic branch, then
repeat the exact close view.

In July 2026, the High-quality WebGPU pipeline's half-resolution GTAO produced
camera-locked horizontal rows across otherwise flat island surfaces. Rendering
GTAO at full resolution removed the rows while retaining contact shading. The
fixed `close-clear` High/WebGPU benchmark remained at 59.9 FPS on the integrated
browser's desktop machine; re-profile Pixel-class Android hardware before
generalizing that performance result.

Also in July 2026, interleaved per-pixel ray jitter in the reduced-resolution
mist pass printed a crosshatch over smooth walls and ground. A fixed midpoint
sample removed the lattice but exposed coherent ray-step intervals at grazing
angles. Wide white-noise jitter broke those intervals but printed stipple, and
a two-pass Gaussian reconstruction pushed the complete High graph from 59.9
FPS to about 31 FPS in the integrated browser. Sampling filtered noise from
world view direction avoided grain, but it made surface mist slide like a
reflection while panning. Keep the camera-independent midpoint until a
genuinely world-anchored alternative is proven. An irregular world-space
height field is useful for the perimeter banks, where it breaks the horizontal
slab silhouette, but do not reuse it for on-island wisps: from above, those
height intersections read as hard-edged puddles.

## Optimize in measured order

Start with the category responsible for the bad tail, then reduce steady-state cost:

1. Remove renderer or frame stalls that cross the interaction threshold.
2. Reduce p95 renderer time on the reported quality tier.
3. Reduce excessive shader programs and draw calls when an ablation shows they matter.
4. Adjust quality budgets only when implementation-level savings are insufficient.

For many forward-rendered spotlights, test stable light layers, a fixed pool of nearby realtime lights, or cheaper ground-light representations for distant fixtures. Keep the visual shafts, pools of light, rain response, and dusk readability comparable; do not silently declare a lower-quality result optimized.

## Verify the fix and its visual cost

1. Repeat the exact failing run at least once under comparable thermal conditions.
2. Exercise the transition or camera movement that originally stalled.
3. Compare median, p95, longest frame, preparation stalls, renderer stalls, effective pixel ratio, and scene counters.
4. Use `quiet-blocks-visual-iteration` to compare the affected High-quality view when lighting, weather, atmosphere, shadows, or post-processing changes.
5. Run focused regression tests and the narrowest relevant type or build check.
6. Leave the app running when practical and report the benchmark URL, commit, capture path, device state, and anything intentionally left unverified.

Do not generalize from one clean capture. State whether evidence covers cold startup, first movement, steady state, or only a simplified diagnostic stage.
