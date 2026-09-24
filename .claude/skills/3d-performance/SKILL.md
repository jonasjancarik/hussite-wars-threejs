---
name: 3d-performance
description: Keeping the 3D battle view (views/3d) fast and measuring it honestly — the on-demand frame loop, the draw-call budget, merged models and scenery, shadow and upload rules, and how to time things in the browser pane and in Node. Use before adding anything drawn per hex, unit, piece or frame, before touching the frame loop, lighting, picking, overlays, banners or terrain generation, and whenever the 3D view feels slow.
---

# 3D performance

The `3d-diorama` skill covers how the battlefield looks and the build-and-look loop. This skill covers what keeps it fast. Most of the rules here exist because breaking them once cost a lot.

## Baseline (2026-09-23, Malešov, High tier, WebGPU)

These are the numbers to compare against. Re-measure rather than trusting them blindly.

| Measure | Value |
|---|---|
| Draw calls, steady frame | 346 |
| Shader programs | 120 |
| Terrain pick (hover, click, depth-of-field focus) | about 0.03 ms |
| Terrain build per map in Node | 0.2–1.1 s |

A redraw of the shadow map adds roughly one draw per shadow caster to its frame. If the draw count jumps by hundreds, something is no longer being merged.

## Rules the renderer relies on

- **An idle battle draws nothing.**
  - New motion keeps frames coming through the `settling` check in `main.ts`, or through the low-rate ambient timer used by snow and the target pulse. Never add a permanent `requestAnimationFrame` loop.
  - Changes nobody can see should not request frames. For example, refocusing while the depth-of-field blur is under half a pixel draws nothing.
- **Don't add a mesh per hex, piece or figure.**
  - Models are merged when they load (`model-merge.ts`). A textured, transparent or skinned material silently leaves that model unmerged, which costs roughly 10× the draws.
  - Static scenery built in `GeneratedScenery` is drawn through `MergedScenery` (`scenery-merge.ts`). Hide a piece with `visible`, and its merged mesh follows on the next `sync()`.
  - The source pieces sit on layer 31. A raycast or `Box3` over scenery has to allow for that.
  - For per-hex visibility, rebuild the index of one mesh, as the fog cover does. Don't toggle hundreds of meshes.
- **Shadows are one 4096² VSM map, rendered and blurred whole.**
  - Invalidate it only when a caster actually changed.
  - `invalidateShadows(true)` is for gradual changes: formations turning in place and the sun easing. Those redraw at most about 15 times a second.
  - Moves, strikes and losses redraw immediately, because a lagging shadow visibly trails a fast move.
- **Upload only what changed.**
  - Don't set `needsUpdate` on buffers that didn't change. For partial writes, use `addUpdateRange`.
  - Rewriting terrain positions bumps their version, which rebuilds the picking grid in `ray-index.ts`.
  - To move existing geometry, rewrite its buffer in place instead of allocating a new geometry every frame (see the commander aura).
- **Keep the hot paths hot.**
  - Picking runs on every mouse move and on every frame the camera moves. Terrain meshes go through `intersectMeshes`, never `Raycaster`.
  - In per-vertex generation loops, avoid string-keyed lookups. `getCell` building `"col,row"` strings once took 38% of the terrain build.
  - `weightsAt` returns frozen, memoized objects. Copy before changing one.
- **Minimize the DOM work in the frame loop.** Banners write only the styles that changed, and skip layout when their anchors didn't move. Never read layout after writing in the loop.
- **Watch shader structure.**
  - WGSL forbids ordinary `texture()` samples inside a per-pixel branch. Take `dFdx`/`dFdy` outside the `If` and sample inside it with `.grad()` (see `triplanar`).
  - Share materials. Every new material instance means new GPU bindings, and every new node graph means a compile stall on its first frame. Graphics settings show `ApplyingNote` for that stall.
- **Coalesce snapshots.** `effect()` defers its render with `queueMicrotask`, so a burst of events builds a single snapshot. Don't call `render()` in a loop.

## Measuring without fooling yourself

- **Draw calls and triangles.**
  - Run `r = game.view.threeMap.renderer; r.scheduleFrame()`, then read `r.lastRendererCounters` after the frame.
  - The first frame after a shadow invalidation includes the shadow pass. Compare steady frames with steady frames.
- **The browser pane can throttle `requestAnimationFrame` to 1 Hz**, even while `document.hidden` is false. Timers keep running normally.
  - Probe the rate with a few `requestAnimationFrame` intervals before trusting any frame rate.
  - Take a screenshot to bring the pane to the front.
  - Prefer counts (draws, frames per interaction, uploads) over frame rates.
- **GPU time.**
  - Render passes update once per animation frame, so calling `pipeline.render()` twice in one task redraws only the final quad.
  - Render inside `requestAnimationFrame` and await `renderer.backend.device.queue.onSubmittedWorkDone()`.
  - Use the results only to compare variants.
- **Auto quality.** The default. It steps down when the median frame interval misses the frame-rate target (30 fps by default) and back up when the next tier's predicted work fits 85% of it. Work is measured from frame start to `onSubmittedWorkDone`, because vsync caps the intervals, and each step's cost ratio is learnt across tier changes (1.3–1.4× on an Apple GPU in the pane, where Low/Medium/High cost about 13/17/23 ms), with a doubling back-off before retrying a tier that failed. CPU stalls count too: slow picks once lowered the tier on a fast GPU. Check `qualityTier()` before judging how something looks.
- **Terrain generation.**
  - `npm --prefix views/3d run bench:terrain` prints the build time and a buffer fingerprint for every generated map.
  - For a refactor that should change nothing, run with `-- --save before.json` first and `-- --compare before.json` after. The comparison must report every map unchanged.
  - To find hot spots, run the script as `node --experimental-strip-types --cpu-prof --cpu-prof-dir=<dir> scripts/terrain-bench.ts <map>`, then sort the profile nodes by self time.
- **Before/after visuals.**
  - Open two tabs: the main checkout's server, and a server for your worktree (add a `launch.json` entry with `http.server --directory`).
  - Use the same scenario and the same camera: set `camera.position` and `controls.target`, then call `settleCamera()`.
  - Hide the labels with `setUnitLabelsVisible(false)` and turn depth of field off with `setFocusSettings(false, …)`.

## Working beside another session

The bundle is built from whatever tree you build in. If `main` moves while you work in a worktree, rebase the worktree and rebuild before staging the bundle. Otherwise the commit ships a bundle without the other session's work.
