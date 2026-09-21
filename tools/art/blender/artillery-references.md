# Artillery batch

Read when revising the houfnice, tarasnice, bombard or gun crew.

Created 21 September 2026. Three original static gun models and one reusable crew figure extend the existing faceted diorama kit. They are visual interpretations of early artillery, not measured reconstructions or functional gun designs. No downloaded geometry or textures are used.

## References and decisions

| Reference | Used for | Limits |
| --- | --- | --- |
| [Tábor visitor information: Hussite Museum](https://www.visittabor.eu/husitske-muzeum), [display photograph](https://www.visittabor.eu/imagecache/1000x800_bslist1282_20240314-134113.jpg) | Visually inspected: short broad barrel, smaller rear chamber, reinforcing hoops, timber bed, spoked wheels and iron fastenings. | A museum display is useful construction reference; the photograph alone does not establish the age or original form of its carriage. Our carriage dimensions and supports are illustrative. |
| [Museum of Eastern Bohemia: Uprostřed Koruny české, exhibition guide](https://www.muzeumhk.cz/images/publikace-zdarma/uprostred-koruny-ceske-pruvodce.pdf) | Catalogue context for the rare Nový Bydžov houfnice barrel and its early-15th-century setting. | The model does not reproduce that object or assert its deployment in a particular battle. |
| [Hussite warfare overview: weapons](https://husitstvi.cz/vojenstvi/husitske-valecnictvi-trochu-jinak/zbrane-husitskych-valek/), [tarasnice entry](https://husitstvi.cz/vojenstvi/rejstrik-vojenstvi/tarasnice/) | Indexed descriptions distinguish field-gun families and mention hoop-bound barrels and simple timber supports for tarasnice. | Secondary material. Direct page retrieval was unavailable during this pass; used only for broad classification, not exact dimensions. |
| [Heeresgeschichtliches Museum: artillery halls](https://www.hgm.at/besuch/heeresgeschichtliches-museum/ausstellungen/artilleriehallen) | Museum context for 15th-century stone-throwing guns and the Pumhart von Steyr. | Our compact bombard is not a scale model of that exceptional giant gun. |
| [KCD II siege screenshot](https://game-checklists.com/images/kcd2-finger-of-god-cannon.webp), from [The Finger of God guide](https://game-checklists.com/kcd2/guides/finger-of-god-quest/) | Visually inspected: heavy hoop-bound muzzle presented as part of a timber siege position. | Game reference from a 1403 setting; not evidence for later Hussite deployment, calibre or crew size. |

The houfnice has a short broad barrel and a compact two-wheel timber carriage. The tarasnice has a visibly longer, slimmer barrel on a lower wheeled bed. The bombard is broader and heavier, resting on ground timbers rather than wheels. Barrel mouths have actual recessed interiors; reinforcing rings are open so they do not cap the bore. All geometry remains opaque and matte, with a small number of wood, iron and stone materials.

## Game use

| Unit definitions | Gun model |
| --- | --- |
| `HOUFNICE`, `HOUFNICE_PRASKY` | `artillery_houfnice` |
| `TARASNICE`, `POLNI_DELO` | `artillery_tarasnice` |
| `BOMBARDA` | `artillery_bombard` |

The generic opposing field gun currently shares the tarasnice silhouette. This is a deliberate coverage choice, not a claim that the two roster entries were identical historical weapons. No unit definition, side assignment, statistic or scenario roster changes.

Each artillery unit displays one gun and two `artillery_gunner` figures. Two figures stand for the crew; the game's lore describes larger crews for some guns. They are not separate selectable people and are not a historical headcount. The gun and each figure sample the terrain independently. Placement follows the actual facing of the unit, so the crew stays beside and behind its gun on either side.

The crew reuses the infantry batch's clothing and kettle hat, with an apron, tool pouch and upright ramrod. Only `team_cloth` changes between muted red and blue; the gun retains neutral wood and iron. The comparison render shows both palette options without adding either gun to a faction's roster. All poses and wheels are static. Loading, firing and deployed/limbered pose variants remain future work.

## Rebuild

From the repository root:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/build_assets.py -- artillery_houfnice artillery_tarasnice artillery_bombard artillery_gunner
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_artillery_batch.py
python3 tools/art/blender/validate_exports.py
npm --prefix views/3d test
npm --prefix views/3d run build
```

`artillery_batch.py` is registered with the shared generator. Editable Blender scenes and individual previews are under `source/` and `previews/`; production GLBs are under `assets/3d/models/units/`. The shared manifest records measured dimensions and triangle counts. `previews/artillery-batch.png` shows the exported guns and separately placed crew at a common scale.

## Verification

Inspected individual Blender previews and the final comparison render of exported GLBs. The actual Three.js renderer displayed six red/blue gun assemblies in a temporary browser fixture without warnings or errors; clicking the bombard selected it. Automated checks load the GLBs, trace rays through the muzzle openings, verify ground-level supports and confirm every visible gun/crew vertex fits the existing picking footprint. All 60 3D tests, 20 shared presentation tests, entrypoint/GLB validation and the TypeScript/Vite build passed. The broad rules/AI suite and native Bevy scenes were not rerun for this asset/presentation change.
