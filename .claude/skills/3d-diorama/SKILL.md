---
name: 3d-diorama
description: Working on the 3D battle view (views/3d) — its art direction, how map features get authored, the build-and-look loop in the browser pane, and the pitfalls already hit. Use before changing anything the 3D battlefield renders (terrain, water, vegetation, fortifications, the diorama base, lighting) or when judging how it looks.
---

# 3D diorama view

`views/3d/README.md` documents what the renderer does. This skill covers how to work on it.

## Art direction

- **A diorama on a table, not an endless world.** The board keeps its cut soil face, walnut base and table. Horizon or world-extension ideas belong to a different project.
- **Landforms follow the 2D map exactly.** Smooth shapes within a hex footprint, but never invent terrain the rules don't have.
- **Low-poly models, high-quality light.** Warm late-afternoon palette: straw and sage grass, faceted trees with varied foliage tints. The concept art is inspiration, not a spec.
- **Subtle over busy.** Prefer detail drawn into a surface (the textbook soil section) over geometry sticking out of it. Never tile or mirror a texture across a large surface: the repetition shows immediately.
- **Show taste-sensitive changes before committing.** Grass was removed once for looking bad, and the soil face needed three rounds. Get a screenshot in front of the user, then commit.
- **The hex grid matters for play.** It may fade away from the cursor or over open water, but never disappear.

## Authoring: what is where versus how it looks

- **What is where** lives in the 2D scenario data (`js/data/scenarios.js`). A `mapLabels` entry may carry a semantic `kind`, e.g. `kind: "fortification"` on "Tvrz Malešov". Labels reach the 3D snapshot as `features`, and the generator builds from them.
- **How it looks** is derived by the generator: a gate toward the road or approach, a ditch, a courtyard, placements clear of every formation.
- **Overrides** only for what can't be derived, in a small per-scenario data file (like `assets/3d/scenarios/settlement-authoring.json`, which is guarded by a terrain hash). Never add a new per-scenario branch in TypeScript; the existing ones in `environment-plan.ts` are debt to migrate onto labels.

## Build, test, look

```bash
npm --prefix views/3d test
```

```bash
npm --prefix views/3d run build
```

- **Build writes the committed bundle.** It copies the result to `views/3d/integrated/hex-three.js`; commit it with the source.
- **Bump the cache strings** whenever the bundle or a loaded script changes. The bundle's `?v=` is in `views/3d/ThreeBattleMapView.js`, and the scripts' `?v=` are in `index.html`. Otherwise browsers keep the old build.
- **Run the 2D checks when you touch 2D data or UI.** If you change scenario data or 2D UI files, also run `node validate_scenarios.js`, `node scripts/validate-locales.js` and `node scripts/test-*.js`.
- **Open a battle in the browser pane.** Start the preview named `game` (`.claude/launch.json`), load `http://localhost:8000/?dev=1` (every battle unlocked), then drive it with short `javascript_tool` calls; each call times out after about 45 s:
  - main menu: click the element whose text is `Choose a Battle`, then the act tab (e.g. text starting `II. Žižka`), then `Battle of Malešov`, then the `Start Battle` button, then any `Continue` buttons;
  - to go straight back to the autosaved battle: `Resume current battle`;
  - switch to 3D: `document.getElementById('btn-view-3d').click()`;
  - return to the menu: `window.returnToMainMenu()`.
- **Wait for the 3D view.** Opening it can take 30–70 s while the pane is hidden, because a hidden pane throttles rendering. Terrain generation itself takes 0.5–2 s in Node. Measure there before calling anything slow.
- **Camera:**
  - hold-to-pan needs events on `document` with a `code`: `document.dispatchEvent(new KeyboardEvent('keydown', {key:'s', code:'KeyS'}))`, wait, then the matching `keyup`;
  - Q/E rotate between the hex-aligned bearings, Home frames the armies, the wheel zooms, and left-drag orbits (drag down to look from lower);
  - collapse both side panels before taking screenshots.
- **Compare like with like.** Check the same map from the same camera before and after. Useful fixtures: Vítkov (hills, mud neck, earthworks), Malešov (tvrz, swamp, stream, woods), Živohošť (plains, forest), Kutná Hora (winter, dusk). Sudoměř is hand-authored and bypasses most of the generator.

## Where things live (views/3d/src)

- **Elevation:** `topography.ts` (interpolation across the hex-centre lattice, even hill flanks, relative wet dips).
- **Region blending:** `terrain-regions.ts`, including the shoreline (`shoreWeightsAt`).
- **Surface mesh:** `generated-terrain.ts`: ground blend weights, puddles, shore distance, and the cut face.
- **Shaders:** `generated-materials.ts`: blended ground and rock, water, puddles, soil strata, walnut base.
- **Woods and ground cover:** `woodland-plan.ts` and `ground-tufts.ts`.
- **Fortified manors:** `fortification-plan.ts`, driven from `environment-plan.ts`, with walls from `town-wall-plan.ts`.
- **Table:** `diorama-table.ts`.
- **Light and weather:** `atmosphere.ts` and `lighting.ts`.
- **Grid and highlights:** `overlays.ts`.

## Pitfalls already hit

- **TSL `texture()` nodes ignore `texture.repeat`.** Multiply the UV yourself.
- **`material.normalNode` is in view space.** Build a normal in world space, then convert it with `transformNormalToView`.
- **Flat shading on the fine terrain or cut-face mesh turns into a pixel checkerboard.** Get facets from separate low-poly models, or leave the surface smooth.
- **Anything that must meet the terrain exactly** (puddle water, overlays) has to reuse the terrain's own grid vertices and diagonals, or the edges stair-step and poke through.
- **Hex outlines leak from region rules, not from blending.** Raising a blend temperature only moved the shoreline to the protected core's hex. The fix was a different field for the shoreline.
- **Absolute levels make pits.** Mud or swamp pinned to −0.36 m carved hex-shaped pits into hills; wet ground is now a dip relative to its neighbours. Water keeps one absolute level.
- **Idle battles draw no frames.** Anything animated needs the low-rate ambient loop (as snowfall uses) or has to stay static.
- **Tests compare `Float32` geometry.** Use tolerances, not `===`, for derived values.

## Sharing the checkout

Another agent session may be editing this checkout at the same time. Run `git status` before committing, and look for changes you didn't make. If there are any:
- Stage your own files by path. Never use `git add -A` or `git stash`.
- The bundle is built from the whole working tree, so build it in a temporary `git worktree` (HEAD plus only your files, with `node_modules` symlinked).
- Stage that bundle with `git hash-object -w` and `git update-index --cacheinfo`, leaving their working copy alone.
- A failing test may come from their unfinished work. Check on a clean worktree before blaming yours.
