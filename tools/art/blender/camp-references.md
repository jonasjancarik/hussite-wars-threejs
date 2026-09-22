# Camp and rural prop references

Read when changing `camp_batch.py`, arranging campsite or abandoned equipment props, or comparing the exported camp gallery.

Created 22 September 2026. These eleven original low-poly assets use the shared kit's matte oak, canvas, stone and dark iron palette. They contain no imported game mesh, texture or screenshot. One Blender unit represents approximately one metre. All assets are static and opaque, with no crews, rigs, fire animation, religious marks or faction devices.

## Visual references and limits

The [official KCD II media page](https://www.deepsilver.com/games/kingdom-come-deliverance-ii/media) was checked as the requested reference entry point. Its screenshot section did not provide individually named image links in the retrieved page; the exact images below were instead inspected in the browser from a credited Warhorse environment artist's public portfolio.

| Source | Observed cues and original interpretation | Limits |
| --- | --- | --- |
| [KCD II Malešov camp, wagon and timber screenshot](https://cdnb.artstation.com/p/assets/images/images/085/149/025/large/tomas-svojsa-maleshov-fortress.jpg?1740073685), published in [Tomáš Svojša's KCD II Buildings and Props portfolio](https://svojto.artstation.com/projects/3EZkZJ) | The inspected image shows pale canvas pavilion tents, a wooden spoked-wheel wagon with cloth cover, and unprocessed logs stacked beside the road. These support muted linen, simple timber construction and a practical silhouette. The models use an original ridge tent, smaller open baggage cart, octagonal pavilion and compact timber stack. | The portfolio credits the tents to Robert Benák, the screenshot to Václav Prchlík and level art to Petr Susanka. The game is a visual reference rather than proof of a 1420 camp layout. Its decorated tents, covered wagon geometry and exact colours are not reproduced. |
| [KCD II barrel prop study](https://cdna.artstation.com/p/assets/images/images/085/148/984/large/tomas-svojsa-sudy.jpg?1740073648), in the same [artist portfolio](https://svojto.artstation.com/projects/3EZkZJ) | The inspected study shows bulging stave bodies, flat plank heads, varied barrel sizes and restrained hoops. `camp_barrels` translates these into twelve-sided wooden bodies with four dark wooden hoops and visible lid seams, alongside a plain closed crate. | Only broad construction and scale variation are borrowed. No scanned detail, texture atlas, UVs or original mesh is used. The model's four-hoop arrangement is a simplified design choice. |
| [The Metropolitan Museum of Art: Caldron, 49.69.6](https://www.metmuseum.org/art/collection/search/471343) | The museum's thirteenth- or fourteenth-century French/South Netherlandish vessel and explanation of suspended cooking pots support a rounded hanging vessel above a hearth. `camp_fire` has a small faceted pot with a bail handle on a simple tripod. | The museum object is bronze and wrought iron, not a Bohemian military find. This source supports the general vessel and suspension idea; the dark material, tripod dimensions and cold stone ring are original game-prop choices. No inscriptions are copied. |

The ridge tent, sack ties, compact haystack, ammunition arrangement and damage details are restrained typological interpretations, not reconstructions of identified objects. The ammunition pile contains stone shot, a plain wooden box and a short handling tool; it makes no claim about gun calibre or ammunition capacity. The discarded shield and folded cloth are unpainted and have no emblem. The abandoned wagon is a separate low-sided civilian construction with a broken rim, missing plank sections and a shortened drawshaft; it does not reuse the armed war-wagon crew or banner.

## Asset dimensions and placement

Dimensions are measured source X × Y × Z, including ropes, stakes and debris. The complete footprint is centred at X=Y=0 and the lowest actual vertex is Z=0. Blender -Y is the presentation front, which exports as glTF +Z; both cart shafts follow this convention. The generator bakes object transforms before export, including leaning sacks and damaged boards, so runtime bounds describe the actual vertices.

| Asset | Dimensions, metres | Triangles | Construction and placement |
| --- | --- | --- | --- |
| `tent_small` | 3.080 × 2.927 × 1.986 | 412 | Canvas ridge tent with a narrow entrance, rear panel, poles, pegs, guy ropes and a bedroll. The cloth body is about 2.2 × 2.32 m; the complete extent includes guying. |
| `tent_pavilion` | 4.295 × 4.274 × 3.226 | 740 | Eight-sided canvas pavilion, plain eave band, open entry, centre pole and eight guy ropes. No heraldry or pennon. |
| `baggage_cart` | 1.680 × 2.782 × 1.296 | 2,860 | Two-wheeled timber cart carrying tied sacks and a crate, with twin shafts and a parked support. Uncrewed. |
| `camp_barrels` | 1.250 × 1.149 × 0.763 | 1,732 | Two different-sized stave barrels with wooden hoops and heads, plus a closed crate. |
| `camp_sacks` | 1.084 × 1.028 × 0.725 | 724 | Two tied sacks and a folded, lashed cloth bundle. |
| `camp_fire` | 1.286 × 1.306 × 1.376 | 664 | Cold stone ring with ash, charred logs, tripod and hanging open-mouth cauldron. No flame, glow, smoke or automatic animation. |
| `ammunition_pile` | 1.220 × 0.952 × 0.495 | 948 | Five faceted stone shot, closed supply box and short wooden-handled tool. |
| `haystack` | 1.901 × 1.920 × 1.870 | 316 | Loose tapered stack with a centre stake and a few broad straw ridges. No modern rectangular bale or plastic wrap. |
| `timber_pile` | 0.899 × 1.994 × 0.824 | 864 | Six logs stacked in three touching tiers, with contrasting cut ends. |
| `discarded_equipment` | 1.942 × 1.073 × 0.191 | 194 | Dropped plain wooden shield, spear, folded neutral cloth and broken staff. No faction or religious assignment. |
| `wagon_abandoned` | 2.446 × 3.980 × 1.471 | 2,884 | Uncrewed four-wheel timber wagon with an incomplete wheel, broken deck/side boards, one shortened shaft and ground debris. |

These are decorative scene assets. Placement does not itself imply collision, supplies, recruitment, faction ownership or fire effects. Existing `artillery_houfnice`, `artillery_tarasnice` and `artillery_bombard` exports can be placed without gunner figures for abandoned guns; this batch deliberately has no duplicate artillery meshes.

## Build and gallery

The shared generator owns canonical `.blend` sources, GLBs and the manifest. Rebuild the assets sequentially through it after registration:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/build_assets.py -- tent_small tent_pavilion baggage_cart camp_barrels camp_sacks camp_fire ammunition_pile haystack timber_pile discarded_equipment wagon_abandoned
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_camp_batch.py
```

The gallery imports the actual GLBs from `assets/3d/models/props`, without consulting the catalog or manifest. All eleven models use scale 1; a labelled one-metre bar shows the common physical scale. It writes `previews/camp-batch.png`. Append `-- --output /tmp/camp-batch.png` for a private preview, or also pass `--models-dir /tmp/camp-private` to inspect privately exported GLBs.

## Geometry checks

Private Blender 5.2 exports were checked with BMesh before canonical integration. All eleven assets have closed manifold mesh parts, no zero-area faces and positive signed volumes. The true transformed bounds are grounded at Z=0 and centred over the entire XY footprint. Small props remain below 2,500 triangles, the tents and baggage cart below 6,000, and the abandoned wagon below 8,000. Canvas is thin solid geometry, the cauldron has a closed interior wall, and damaged parts retain closed cut surfaces.

The common-scale private GLB gallery was rendered and visually inspected. This caught a transform-order issue in the scaled sack ties; the ties were corrected, the geometry checks repeated, and the updated gallery confirmed that the rings sit on the sack necks. Gallery labels, framing, tent entrances and wagon damage were checked in that final image. Canonical exports and runtime placement are verified by the integration workflow separately.
