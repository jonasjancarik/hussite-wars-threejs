# Support-unit model references

Read when revising `support_units.py`. Created 21 September 2026. The module supplies static, original low-poly meshes for the shared Blender battlefield kit. It uses no copied mesh, texture or animation. All figures face +X, are grounded at Z=0, and use opaque, high-roughness kit materials.

## Evidence and modelling choices

| Reference | Used for | Limit |
| --- | --- | --- |
| [Unit data: polearm infantry](../../../docs/design/jednotky_rozsireni.md) | The project describes sudlice/kosa/halberd infantry. The replacement `infantry_polearm` has a narrow pointed glaive blade and forward hook; `infantry_halberd` has a broader forward axe blade, rear hook and top spike. | The source is game design data, not a measured museum object. Both heads are readable stylisations rather than reconstructions of particular surviving Czech weapons. |
| [The Met, Swiss halberd ca. 1400, 2020.251](https://www.metmuseum.org/art/collection/search/845840) and [Swiss halberd ca. 1375–1400, 14.25.35](https://www.metmuseum.org/art/collection/search/25854) | Period check for an unornamented early axe-led weapon, wooden shaft and the transition to a central socket in the early fifteenth century. The roughly 2.60 m model is shorter than the sudlice and visibly different from the long spear. | These are Swiss objects, not evidence for a specific Bohemian soldier. Their overall lengths are about 2.0–2.14 m; our weapon and head proportions are enlarged for miniature readability. No later pierced ceremonial axe head is copied. |
| [KCD II crossbowman screenshot](https://cdn.mos.cms.futurecdn.net/qbY6sXXeJEidZYeVBsqTpF.jpg), reproduced by [PC Gamer](https://www.pcgamer.com/games/rpg/kingdom-come-deliverance-2-honors-elden-ring-legend-let-me-solo-her-in-touching-easter-egg/) | Visual inspiration for the simple dressed foot soldier and crossbow posture already established in `infantry_batch.py`. The existing handgonne and wagon figures retain that kit's silhouette rather than copying a game model. | KCD II is visual reference and is set in 1403. It does not prove the ordinary equipment, colours or precise poses of every 1420 combatant. |
| [Vítkov unit definition](../../../js/data/unitTypes.js) and [Vítkov account](../../../js/i18n/locales/cs.json) | These local, source-backed descriptions identify the defended feature as fixed sruby and a wall, with crossbows and polearms; they expressly distinguish it from a mobile wagon. `field_blockhouse` is consequently a low stone breastwork, hewn timber enclosure and two visible crossbow defenders. | The compact 3.00 m × 3.09 m prop is one game hex's representative fieldwork, not a survey or complete plan of the Vítkov defences. |
| [Czech Ministry of Defence, *Bitva na Vítkově 1420*](https://valecnehroby.mo.gov.cz/aktuality/bitva-na-vitkove-1420) | Corroborates that Žižka's works on Vítkov comprised two timber sruby, an earlier vineyard tower, stone walls and ditches. It supports timber-and-stone cover as the representative silhouette. | The source describes the wider fortification and battle. It does not provide the measured geometry of a surviving individual blockhouse. |
| [Scenario text for Vítkov](../../../experiments/sudomer-diorama/web/hex-diorama/vendor/husitske-valky/js/data/scenarios.js) | Corroborates a narrow ridge defended by sruby and walling, plus a small garrison including women. The model keeps only a restrained fixed-cover silhouette, leaving the terrain and larger defence to the scenario. | Scenario prose is a game reconstruction. It is used only to avoid misrepresenting the unit as a wagon or castle. |

## Asset decisions

- `infantry_polearm` and `infantry_halberd` reuse the current padded-jack infantry body. Both hands are placed mathematically on the shaft; the former has one pointed blade and a modest hook rather than an extra disconnected spear point. The halberd axe faces forward. Weapon plates are closed solids with outward normals.
- `infantry_handgun` uses the shared infantry body. The handgonne sits on a long wooden tiller braced under the right arm, with two barrel bands, a touch hole and a match cord looped from the right hand. Coat, skirt and sleeves use `team_cloth`; the powder flask remains ochre. Renderer-selected muted red/blue variants are game readability colours, not a historical uniform claim.
- `infantry_shield` uses the shared infantry body with a raised arming sword. The slightly curved board has rounded lower corners, a bound rim, a small iron boss and a connected rear grip, and sits ahead of the left hand. `team_paint` covers the board and a single pale diagonal band crosses it. It is a generic game shield, not a specific mercenary company's arms.
- `war_wagon` calls the original wagon builder. Only named tunic, skirt and sleeve parts plus existing banner cloth use `team_cloth`. Powder flasks, wood, metal and skin retain their original materials. The existing pale chalice remains linen because both Hussite and Prague wagon definitions already use that signal. The shared kit fixes the old polearm blade's collapsed bevel; its outline and the rest of the wagon remain unchanged.
- `commander_standard` occupies the older banner's 3.5 m high, sub-1 m wide envelope. Two pale bands are material regions on both faces of a closed, gently folded cloth mesh. It has no chalice, cross or personal arms; the stripes are an invented neutral game marker. Cloth ties connect it to the crossbar.
- `field_blockhouse` combines continuous low stone courses with ground-supported timber walls and a small braced rear shelter. Its open firing bay exposes both static crossbowmen from above, and their weapons clear the front cover. Solid wooden roof planks replace the draft's thin red roof sheet. The shortened roof, open rear and two-person garrison are explicit readability choices, not evidence for the original Vítkov building's plan, roof material or garrison size. No tower, castle or additional environment asset is introduced.

## Measured source geometry

Blender 5.2 measurements on 21 September 2026, before export consolidation. Dimensions are X × Y × Z in source metres; radius is the greatest horizontal vertex distance from the model origin. All new models reach Z=0; the retained wagon's tyres sit about 0.01 m above it.

| Asset | Dimensions | Radius | Triangles |
| --- | --- | --- | --- |
| `infantry_polearm` | 1.337 × 0.843 × 2.956 | 1.075 | 1,320 |
| `infantry_halberd` | 1.393 × 0.843 × 2.596 | 1.130 | 1,324 |
| `infantry_handgun` | 1.288 × 0.780 × 1.834 | 1.000 | 1,448 |
| `infantry_shield` | 0.781 × 0.985 × 1.861 | 0.695 | 1,452 |
| `war_wagon` | 5.305 × 2.960 × 3.941 | 3.195 | 6,156 |
| `commander_standard` | 0.088 × 0.990 × 3.500 | 0.941 | 292 |
| `field_blockhouse` | 3.004 × 3.090 × 2.720 | 2.133 | 5,516 |

The fieldwork fits inside a hex with inradius 3.46 m. Its 2.133 m radius also fits the existing 2.15 m picking radius tightly; the renderer must cover the 2.72 m roof height rather than assuming infantry height. The wagon keeps its pre-existing larger envelope.

## Scope and verification

This module provides builders only. Its parent registry handles material variants, manifest writes and GLB export sequentially. No export is run from this module. Every individual figure remains below 2,500 triangles and the fieldwork below 8,000.

The review used matching private Blender renders for the polearms, shield, standard and fieldwork, including opposite-side views of the standard and elevated rear views of the fieldwork. The standard's bands remain visible on both sides; both fieldwork helmets and crossbows are visible from the elevated rear view, although the rear shelter partly occludes their bodies. The inherited handgonne and wagon body poses were retained. BMesh checks found no zero-area faces, negative closed-mesh volumes or open meshes in the new support geometry. The original wagon still contains its intentional open banner and chalice sheets. Exact `team_cloth`/`team_paint` materials remain unsuffixed, and neutral powder flasks remain ochre. Final GLB and live renderer checks belong to the parent export/integration pass.
