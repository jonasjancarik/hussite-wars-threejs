# Landscape and fieldwork model references

Read when changing `landscape_batch.py`, joining a bridge approach, seating a fortification on rock, or comparing the exported landscape props with their gallery.

Created 22 September 2026. These eight original low-poly props extend the shared miniature kit. They use matte material colours and editable named parts, without imported game meshes, textures, animation, flags or collision geometry. One source unit is approximately one metre. Blender is Z-up; glTF is Y-up. Each full footprint is centred at the origin and its lowest point is Z=0.

## Visual and historical references

The following images were opened and visually inspected. They inform construction, silhouette and placement; none was traced, extracted or included in the exported assets.

| Reference | Observed cues used | Limits |
| --- | --- | --- |
| [Official KCD II woodland bandits screenshot](https://www.deepsilver.com/media/5uzhmdfx/kcdii_gamescom-screen_bandits-1920.jpg?width=2560&height=1440&v=1dcf4ed12c06f20), linked from the [Deep Silver media gallery](https://www.deepsilver.com/games/kingdom-come-deliverance-ii/media) | Large pale rock faces rise behind conifer trunks; subdued grey rock and brown timber remain distinct from the green understory. This supports broad neutral facets on the rock foundation and restrained colours throughout the kit. | The screenshot does not establish a rock type, dimensions or a castle foundation plan. The broad summit and its level surface are original placement decisions. |
| [Official KCD II battle-start screenshot](https://www.deepsilver.com/media/luqnre2z/kcd2_announce_05_battlestart-1920.jpg?width=2560&height=1440&v=1dcf4ed12886f30), from the same gallery | Palisades follow uneven ground around a modest raised fortified residence. Timber braces and an open-sided covered work area suggest practical, lightly finished construction. The shelter uses the existing kit's hewn posts, short side logs and simple roof framing. | This image is visual context for timber fieldworks on terrain. It is not evidence of a particular Hussite firing shelter, gun platform or siege position. KCD II's 1403 setting predates the game's 1419–37 campaigns. |
| [KCD II shallow-bank screenshot](https://api-cdn.wemod.com/game_map_pin/1299625/750.webp), published in [Wand's Kuttenberg laundry checklist](https://wand.com/maps/kingdom-come-deliverance-ii/kuttenberg/checklist/services/laundry) | The inspected image shows a short weathered plank access, low scattered stones beside shallow brown water, and uneven clumps of wetland growth. It informs the modest bridge approach, irregular ford-edge stones and separate reed clumps. | This is a gameplay screenshot on a third-party map, not a measured crossing or archaeological record. The plank structure appears to be waterside access; it is not evidence of an army ford. Stones and reeds are generic scenery, without a claimed exact plant species. |
| [NPÚ archaeological record: Hrad Sion, site 12001](https://isad.npu.cz/hrad-sion-12001) | The record describes a rocky promontory beside the Vrchlice, an irregular roughly triangular core, and a bailey protected by substantial moats and banks. It supports a generic rock-supported fortified site in this regional kit. | The 6 × 4 m foundation is an abstract reusable plinth, not Sion's plan or terrain. It has no built-in building, ditch or moat. |
| [Archaeological Atlas: Chlístovice / Sion](https://www.archeologickyatlas.cz/cs/lokace/chlistovice_kh_hrad_sion) and its inspected [site plan](https://s3-eu-west-1.amazonaws.com/media.archeologicky-atlas.cz/production/image/2015/03/31/20/03/52/609/file.jpg) | The plan shows irregular rock-edge buildings, a neck ditch, curved banks across the approach and a nearby river. The accompanying account identifies siege earthworks and firing positions; these support the general fieldwork vocabulary. | The source does not specify this kit's roof or plank arrangement. The low gun bed and uncrewed shelter are functional interpretations, not reconstructions of excavated structures. Terrain-following banks, ditches, water and ice belong to the renderer's terrain work and are deliberately absent from these GLBs. |

`field_shelter` also follows the established [field blockhouse construction style](support-unit-references.md), while omitting its garrison. No religious or factional identity is built into any prop.

## Models and placement

Dimensions are measured source X × Y × Z, including projecting timber, stone facets and leaves. All eight are static and opaque. The shelter's firing side, gun bed's front and bridge approach's high end face source +X, which remains glTF +X. The low wall runs along X.

| Asset | Dimensions, metres | Triangles | Construction and placement |
| --- | --- | --- | --- |
| `rock_foundation` | 6.000 × 4.000 × 1.500 | 80 | One continuous irregular rock mass with broad fractured sides. Its summit ring is level at Z=1.500 and has maximum X/Y extents 4.320 × 2.800 m. Those are polygon extents, not a guaranteed inscribed rectangle; fit the structure inside the actual summit or deliberately blend the apron into surrounding terrain. |
| `field_shelter` | 2.950 × 1.933 × 2.060 | 1,160 | Uncrewed covered firing bay with knee-braced posts, hewn timber cover on a low stone footing and an open rear at -X. The roof only covers the rear part, leaving front sightlines clear. The ground beneath the bay remains open. |
| `low_stone_wall` | 3.980 × 0.715 × 1.100 | 2,144 | Three staggered courses of rough stone around a continuous mortar core, with a modest coping. Irregular stone facets, sizes and subtle turns avoid identical exposed seams. No battlements, embrasures or implied gate. |
| `firing_platform` | 3.000 × 2.200 × 0.400 | 716 | Planked gun bed at Z=0.290 with a short continuous access ramp at -X. Low timber-revetted earth shoulders sit outside the bed; two rear stones leave the access open. The central clear bed is approximately 2.40 × 1.58 m. This is a shallow support prop, not a full defensive earthwork. |
| `bridge_approach` | 3.000 × 2.700 × 0.559 | 720 | Planks rise toward +X above timber stringers and a modest stone abutment. The full deck width matches `props/bridge.glb` at 2.700 m. The low plank top is Z=0.090; the high edge at X=1.491 is Z=0.55859. See the joining note below. |
| `ford_stones` | 2.525 × 0.987 × 0.210 | 230 | Five separate flat weathered stones, with varied size and offset placement. Use beside the shallow edge of a ford, with most of the river width visibly open. They should not become an evenly spaced stepping-stone causeway. |
| `reeds` | 1.222 × 0.863 × 1.271 | 496 | Four sparse clumps, each with six bent closed leaves and a solid stem. Only two stems carry small seedheads. Leaves use a thin diamond section; no texture cards, transparency or camera-facing surfaces. |
| `bank_rocks` | 1.891 × 1.101 × 0.650 | 184 | Four unequal low rounded rocks with flat buried undersides and broad weathered facets. Place at the bank edge and allow the terrain or water to conceal some of their base. |

### Joining the existing bridge

The bridge approach is intentionally under 0.6 m high. The existing bridge's outer plank top is approximately Z=0.76795, so equal root heights leave a step. At source scale, seat the bridge approximately 0.20936 m lower than the approach to align those surfaces. With the approach at the origin and pointing +X, a bridge centre near X=5.4785 places its negative-X deck edge beside the approach's high edge. The bridge posts may then extend below the bank surface, as normal embedded supports. Apply the same common scale to both models. Terrain height, orientation and the second bank still need to be checked at placement time.

The rock summit and gun bed do not automatically reposition other assets. Terrain, unit placement and collision remain the renderer's responsibility. Plants and ford stones should be placed as irregular peripheral groups, preserving the navigable crossing and visible water.

## Building and presentation

The shared generator owns registration, canonical editable Blender sources, exports and the manifest. Build sequentially from the repository root:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/build_assets.py -- rock_foundation field_shelter low_stone_wall firing_platform bridge_approach ford_stones reeds bank_rocks
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_landscape_batch.py
```

`render_landscape_batch.py` imports all eight actual exported GLBs at one physical scale. It reads no catalog or manifest and renders a labelled orthographic gallery to `previews/landscape-batch.png`. The shelter is rotated to expose its open rear. For a temporary render, append `-- --output /tmp/landscape-batch.png`.

## Verification

Private Blender checks verified every source part is closed and manifold, has positive signed volume and contains no zero-area faces. Exact vertex bounds confirm Z=0 grounding and centred full footprints. All meshes stay below their requested triangle budgets: small props below 2,500 triangles, rock and shelter below 5,000.

A separate triangulated, coplanar face-intersection check found zero positive-area overlaps between different parts. This included hidden underside and touching course faces: roof posts were inset into their logs, masonry courses received narrow seams, and grounded support footprints were separated. Intended volumetric intersections still join framing and embedded stonework. These checks do not make the assembled kit a single unioned manifold solid.

Individual previews were inspected for the foundation's level summit, shelter framing and actual three-dimensional reeds. The actual-GLB gallery provides the final silhouette and scale comparison. Runtime terrain seating, bank orientation and any bridge joins must also be checked in the renderer after placement; a studio render alone cannot prove those connections.
