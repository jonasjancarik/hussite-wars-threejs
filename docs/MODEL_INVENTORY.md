# Model inventory and remaining needs

Read when planning 3D assets, faction appearance, or scenery for another battle.

Inventory updated: 22 September 2026. Scope: this checkout's canonical unit/scenario data and the Three.js renderer in `views/3d`. “Available” means a GLB exists; it does not necessarily mean the renderer uses it or that its appearance has passed visual review. This is an asset-planning inventory, not a new historical audit.

## Art direction and historical references

Keep the existing low-poly diorama art direction: simple faceted geometry, readable silhouettes, restrained materials and colours, miniature proportions, and static figures. Historical detail should improve the recognisable shape and construction of an object without turning the scene into a photorealistic game.

Use **Kingdom Come: Deliverance II screenshots as a preferred visual reference** for Bohemian clothing, armour, helmets, weapons, horse equipment, buildings and everyday props. Start with the [official media gallery](https://www.deepsilver.com/games/kingdom-come-deliverance-ii/media) and the [released gameplay screenshots collected by Gematsu](https://www.gematsu.com/2024/08/kingdom-come-deliverance-ii-gameplay-showcase-video-screenshots). Record the particular screenshot used when developing an asset, so its reference remains inspectable.

The useful translation into our style is:

- Preserve clothing layers, helmet and weapon profiles, shield shapes, and differences in equipment between ordinary soldiers and wealthy nobles.
- For buildings and props, preserve structural features such as roof form, timber framing, masonry, gates and wagon construction.
- Simplify small fittings, fabric folds and surface wear into a few clear shapes and colour areas. Judge the result at normal gameplay zoom.
- Keep side colours as selective readability accents; retain variation in ordinary clothing and equipment. Continue with static figures and optional discrete poses as described below.

KCD II is set in **1403**, shortly before this game's **1419–1437** campaign ([setting and screenshot source](https://www.gematsu.com/2024/08/kingdom-come-deliverance-ii-gameplay-showcase-video-screenshots)). It is a useful nearby-period reference, not proof for every detail of a later Hussite battle. Cross-check date-sensitive armour, firearms, wagon defences, heraldry and named buildings against historical sources when choosing those details. Screenshots guide newly authored models; game meshes and textures are not part of our asset library.

## Current coverage

The basic unit set is complete: **all 59 unit definitions have explicit 3D recipes**, including the 27 commanders, both wagon types, mixed civilian groups and the fixed fieldwork garrison. Models use shared families rather than one unique mesh per definition. There are **56 GLB files** across the shared library and retained experimental variants.

The completed batches cover flails, crossbows, pavises, spears, archers, three artillery families and crew, light/scout/heavy cavalry, dismounted knights, civilians, three commander bases, halberdiers, a blockhouse with garrison, and a neutral commander standard. Older handgun, sword/shield and wagon models now support faction colours. Unit rules and scenario rosters are unchanged; the existing explicit dismount state is now displayed and preserved in saves.

[Infantry references](../tools/art/blender/infantry-references.md), [artillery references](../tools/art/blender/artillery-references.md), [cavalry references](../tools/art/blender/cavalry-references.md), [remaining figures](../tools/art/blender/people-references.md), and [fieldwork/support references](../tools/art/blender/support-unit-references.md) record the visual sources and interpretation limits. The remaining work below concerns environment kits, individual character details, researched heraldry and optional pose/equipment variation.

### Available model files

Shared paths below are relative to `assets/3d/models/`. The six `battle/` and `benchmark/` variants remain under `experiments/sudomer-diorama/assets/models/`; they are available experimental exports, not production mappings. Shared logical IDs are resolved by `assets/3d/model-paths.json`.

| Files | Count | What we have / limits |
| --- | ---: | --- |
| `units/infantry_flail.glb` | 1 | Iron-bound wooden flail, kettle hat and padded clothing; both flail unit types. |
| `units/infantry_crossbow.glb` | 1 | Crossbow, stirrup and bolt case; all four crossbow types. |
| `units/infantry_pavise.glb` | 1 | Tall ribbed pavise with wooden back and sword; both pavise types. |
| `units/infantry_spear.glb` | 1 | Long upright spear with a plain leaf-shaped head; both spearman types. |
| `units/infantry_archer.glb` | 1 | Static drawn wooden bow, nocked arrow, hip quiver and cloth cap; existing archer type. |
| `units/infantry_polearm.glb` | 1 | Dedicated sudlice silhouette, kettle helmet and faction-colour cloth; no generic fallback. |
| `units/infantry_handgun.glb` | 1 | Handgunner with faction-colour coat and neutral powder flask; used only for ručničáři. |
| `units/infantry_shield.glb` | 1 | Sword and plain striped shield with faction colours, used for mercenaries and dismounted scouts. |
| `units/cavalry.glb` | 1 | Original horse and polearm rider with `HorseWalk`; retained unchanged. The campaign now uses the static mounted variants below. |
| `units/cavalry_light.glb`, `units/cavalry_scout.glb`, `units/cavalry_heavy.glb` | 3 | Static light rider, equipped scout and armoured knight; all eight cavalry definitions, with side-colour cloth and shields. |
| `units/war_wagon.glb` | 1 | Defensive wagon with two crew, wheels, towing poles, stakes and chalice flag. |
| `units/artillery_houfnice.glb`, `units/artillery_tarasnice.glb`, `units/artillery_bombard.glb` | 3 | Short field gun, long light field gun and heavy siege gun; one model per artillery unit. |
| `units/artillery_gunner.glb` | 1 | Static ramrod-bearing crew figure with side-colour cloth; two independently grounded figures accompany each gun. |
| `props/banner.glb` | 1 | Original red chalice prop retained for legacy scenes. |
| `props/commander_standard.glb` | 1 | Faction-colour standard with two neutral pale stripes; every commander receives a separate instance. |
| `units/civilian_adult.glb`, `units/civilian_woman.glb`, `units/civilian_child.glb` | 3 | Mixed pilgrim group with ordinary clothing, bundles and walking staff. |
| `units/commander_captain.glb`, `units/commander_noble.glb`, `units/commander_cleric.glb` | 3 | Shared captain, armoured noble and cleric bases covering all 27 leaders. |
| `units/infantry_dismounted.glb` | 1 | Armoured foot soldier used when heavy cavalry explicitly dismounts. |
| `units/infantry_halberd.glb` | 1 | Distinct axe-and-hook halberd silhouette, with faction-colour clothing. |
| `buildings/field_blockhouse.glb` | 1 | Fixed timber/stone fieldwork with open firing bay and two visible crossbow defenders. |
| `buildings/church.glb`, `buildings/farmhouse.glb`, `props/bridge.glb`, `props/stakes.glb` | 4 | Generic church, house, timber bridge and crossed timber obstacle. |
| `buildings/fort_wall.glb`, `fort_wall_corner.glb`, `fort_gatehouse.glb`, `fort_tower_square.glb`, `fort_tower_round.glb`, `fort_manor.glb`; `props/timber_palisade.glb` | 7 | First reusable fortification kit: two wall modules, an open gatehouse, two roofed towers, a residential keep and a palisade. Composed manor scenery replaces the four farmhouses at Nekmíř and Malešov. The corner wall is available for later assemblies. |
| `vegetation/broadleaf_olive.glb`, `vegetation/broadleaf_gold.glb`, `vegetation/cypress.glb` | 3 | Original stylized vegetation. |
| `vegetation/sudomer/tree-a.glb`, `vegetation/sudomer/tree-b.glb`, `vegetation/sudomer/tree-c.glb`, `vegetation/sudomer/shrub.glb` | 4 | Separate Sudoměř vegetation set. |
| `vegetation/procedural-worlds/pw_deciduous_01.glb`, `vegetation/procedural-worlds/pw_deciduous_02.glb`, `vegetation/procedural-worlds/pw_deciduous_03.glb`, `vegetation/procedural-worlds/pw_shrub_01.glb` | 4 | Additional vegetation; generated battle scenery currently selects deciduous 02. |
| `battle/unarmed_adult_static.glb` | 1 | Retained experimental export; its shared unarmed body construction is reused by the new civilian adult. |
| `battle/horse_rider_static.glb`, `battle/war_wagon_crewless.glb` | 2 | Experimental static rider and empty wagon; not separate gameplay classes. |
| `benchmark/infantry_polearm_flat.glb`, `infantry_handgun_flat.glb`, `infantry_shield_flat.glb` | 3 | Flattened benchmark copies, not additional troop identities. |

The original kit has editable Blender sources and an export manifest. The subfolders also have manifests. The flattened battle/benchmark exports use vertex colours, so selective coat recolouring is less straightforward than with separate cloth materials. Only the cavalry GLB contains an animation clip; the current Three.js unit presenter does not play it.

### Static figures and future poses

Static figurines are the intended diorama style. The lack of continuous character animation is acceptable and is not an asset gap to resolve. Walking, attack and death animation cycles are not required.

Later, discrete poses could make gameplay states easier to read while preserving the miniature appearance:

| Pose | Possible appearance |
| --- | --- |
| At ease | Weapons lowered and a relaxed stance. |
| Ready | Shields forward and weapons raised. |
| Fortified | Crouched behind a pavise or firing over wagon boards. |
| Marching | A fixed walking or riding pose, without a repeating movement cycle. |
| Routing | Turned away with weapons lowered. |

These are optional future variants, not a commitment to implement new gameplay states. Reuse bodies and equipment where practical; a pose change need not be animated. Prioritise recognisable unit types and side colours first, then add poses where they communicate an actual gameplay state.

### Existing scenery that is not a model file

The renderer already generates terrain, water and meadow geometry. Authored Sudoměř adds grass/stubble, small stone field enclosures and flowers procedurally. Do not commission replacement GLBs just because those objects are absent from the model directory.

Only Sudoměř has a complete authored scenario-art manifest registered. Other scenarios use terrain-derived scenery: forest → tree, town → farmhouse, church → church, trenches → stakes. Nekmíř and Malešov additionally have small composed manor sites at their existing four labelled town hexes. These use the shared fortification kit, with open hex centres and breaks in the perimeter; the renderer does not introduce collision, movement costs or new defences. Each piece follows the existing explored-cell fog rule. If the expected town cells change, placement falls back to ordinary terrain scenery.

The manor compositions are illustrative, not archaeological reconstructions. Their roof forms, timber framing, rubble masonry and stairs use [recorded KCD II screenshots and NPÚ references](../tools/art/blender/fortification-references.md). Other labelled castles, fortified cities and monasteries still need deliberate placement and site research; a generic building on a town tile does not complete them.

## Unit coverage and optional variants

| Visual family | Unit types covered | Current coverage | Optional later work |
| --- | --- | --- | --- |
| Flail infantry | `CEPNICI`, `CEPNICI_PRASKY` | New `infantry_flail`, red/blue cloth | Covered for the first batch; optional clothing and pose variants later. |
| Polearm infantry | `SUDLICNICI`, `HALAPARTNICI` | Separate sudlice and halberd silhouettes, both with side colours | Additional weapon/stance variations. |
| Spearmen | `KOPINICI_HUSITI`, `KOPINICI` | Dedicated `infantry_spear`, red/blue cloth | Base coverage complete; braced/lowered spear poses can follow later. |
| Pavise infantry | `PAVEZNICI`, `PAVEZNICI_KRIZACI` | New `infantry_pavise`, red/blue cloth and shield paint | Covered for the first batch; planted/fortified pose and researched decoration remain future work. |
| Crossbowmen | `KUSINICI_HUSITI`, `KUSNICI`, `KUSNICI_JANOV`, `KUSINICI_PRASKY` | New `infantry_crossbow`, red/blue cloth | Shared weapon silhouette covered; Genoese equipment variation still needs reference checking. |
| Handgunners | `RUCNICARI` | Matching handgun model with side-colour coat | Weapon and loading-pose variants. |
| Archers | `LUCISTNICI` | Dedicated `infantry_archer`, drawn bow and hip quiver | Base coverage complete; relaxed/loading poses remain optional. The existing archer type belongs to the opposing side. |
| Mercenary infantry | `ZOLDNERI` | Sword and neutral striped shield, with side colours | Mixed equipment and clothing variations. |
| Light cavalry | `JIZDA_HUSITI`, `LEHKA_JIZDA`, `JIZDA_PRASKY` | Dedicated `cavalry_light`, red/blue cloth and shield | Base mounted coverage complete; more regional equipment and poses can follow. |
| Scouts | `ZVED`, `ZVED_KRIZACI` | Dedicated `cavalry_scout`, cloth cap, travel gear and no raised lance | Base mounted coverage complete; further clothing/horse variation optional. |
| Heavy cavalry | `SLECHTICKA_JIZDA_HUSITI`, `TEZKY_RYTIR`, `TEZKOODENCI` | Dedicated `cavalry_heavy`, armour, lance, shield and horse cloth | Mounted and explicit dismounted appearances complete. A less armoured men-at-arms variant remains optional. |
| Field artillery | `HOUFNICE`, `HOUFNICE_PRASKY`, `TARASNICE`, `POLNI_DELO` | Dedicated houfnice/tarasnice models, each with two visual crew figures | Base coverage complete; the generic field gun shares the tarasnice silhouette. Additional crew poses and equipment variants can follow. |
| Siege artillery | `BOMBARDA` | Dedicated bombard on a timber bed with stone shot and two visual crew figures | Base coverage complete. Definition belongs to `hussites`; the displayed pair is a crew abstraction, not the historical crew size. |
| War wagons | `VOZOVA_HRADBA`, `VOZOVA_HRADBA_PRASKY` | Both use the wagon, with red/blue crew clothing and flags; both retain the chalice | Crew poses and damaged/abandoned states. |
| Fieldwork garrison | `POLNI_OPEVNENI` | Fixed timber shelter, low stone front and two visible crossbow defenders | More site-specific fieldworks during battle-environment authoring. |
| Pilgrims | `POUTNICI` | Five figures combining adults, women and a child, with ordinary clothing and bundles | More clothing, luggage and poses. |
| Commanders | All 27 commander definitions; full list below | Explicit captain/noble/cleric assignments and independent faction-colour neutral standards | Individual portraits, dated equipment and researched personal heraldry. |

Dismounted heavy infantry is now shown when the engine explicitly sets `dismounted`. Merely losing a charge bonus, slowing down or appearing in dismount-related narration does not change the model. Existing saves without the optional flag default to mounted; new saves preserve it. Likewise routing, marching, damaged wagons and abandoned guns can be poses or prop states rather than entirely new models.

## Sides, colours and heraldry

Keep **game side**, **historical affiliation**, and **unit equipment** separate. The data uses two gameplay factions, `hussites` and `crusaders`, but the second can represent Prague/moderate Hussites or another coalition. Lipany explicitly defines blue Prague variants. A blue Hussite wagon should not automatically receive a crusader cross.

Every active unit family now has deliberate side-colour slots where appropriate, including the older soldiers and wagons. Civilian clothing stays mostly neutral, with small side accents. Wood, metal, skin and powder flasks retain their own colours. Commander standards use neutral geometric stripes; researched personal heraldry remains optional later work.

Proposed art scheme, not a claim about historical uniforms:

| Layer | Proposed coverage |
| --- | --- |
| Immediate side recognition | Muted red vs muted blue cloth accents, plus a small formation marker with differing symbol/shape. Keep neutral cloth, leather, wood and metal shared. |
| Hussite identity | Chalice shield/flag variants; optional distinctions between field armies, Prague and allied nobles only where scenario data supports them. |
| Catholic/royal/crusading identity | Appropriate cross, royal or noble banner variants. Verify specific heraldry before making named historical claims. |
| Hussite civil conflicts | Chalices on both sides where appropriate, with opposing side accents and commander standards. |
| Individual leaders | Cleric versus noble versus field captain silhouettes; Žižka-specific head/weapon detail after reference review; heraldic shields as interchangeable parts. |
| Variation within a formation | A few neutral coat colours, helmet/head variants, shield designs and horse coats. Avoid making every person look uniformly dressed. |

Use a small number of shared meshes with interchangeable weapons, shields, headgear, cloth materials and flag designs. The presenter clones and caches tagged materials per appearance variant, preserving the original prototype. Extend that convention to future models; `clone(true)` alone shares materials and must not be used to recolour both armies accidentally.

## Battle surroundings and distinctive props

These are candidates derived from current map labels, terrain and battle lore. They are not verified reconstructions of medieval architecture. Generic kits can establish a readable scene; named landmarks require period references before detailed modelling. Modern castle/church appearances should not be copied unquestioningly.

| Scenario | Main scenery need | Available foundation / remaining gap |
| --- | --- | --- |
| Živohošť 1419 | Červenka hill, Vltava ford, pilgrim procession | Terrain/trees and civilian models exist; ford treatment remains environment work. Lore explicitly excludes a wagon fort here. |
| Nekmíř 1419 | Small fortified manor at Nekmíř, road and wagon position | Generic manor, gate, square tower, walls and palisade now placed at the labelled site. Exact medieval architecture and battlefield layout remain uncertain. |
| Sudoměř 1420 | Pond, drained muddy basin, narrow embankment, wagon line | Strongest existing authored coverage. Civilian and dismounted assets are available; consider optional reeds/pond-edge details and authored civilian scenery; no castle needed for the central scene. |
| Vítkov 1420 | Narrow ridge, timber blockhouses and defensive wall | Terrain and the fixed blockhouse/garrison unit exist; site-specific fieldwork composition remains environment work. Prague skyline could be distant context, not a substitute for the ridge defences. |
| Vyšehrad 1420 | Fortress, Vltava/Botič, Pankrác plain, Podolí slope, siege lines | Wall/tower/gate kit now available; still needs a researched fortress composition and earthworks. |
| Žatec 1421 | Fortified town on promontory, Ohře, western attack front | Town wall/gate/tower kit, dense houses and besiegers' camp. Optional camp-fire state from scenario events. |
| Kutná Hora 1421 | Town, Kaňk hill, roads and breakout route | Town kit and winter/night scene treatment. Cattle are optional tradition-related scenery, not a required combat unit. |
| Německý Brod 1422 | Town, Sázava crossing, bridge and ice | Timber bridge exists but generic scenery does not automatically place it at this crossing. Add crossing placement and readable intact/broken-ice surface states. |
| Most 1421 | Hněvín castle, town, monastery | Fortification parts available, but hilltop castle assembly and monastery compound still missing; reuse church only as a generic starting piece. |
| Ústí 1426 | Na Běhání slope, double wagon line, distant town | Reuse wagon/terrain; extend town backdrop. Maintain separation between the two wagon rows. |
| Tachov 1427 | Town edge, roads toward Bavaria/Stříbro, retreating camp | Reuse terrain/houses; add gate/walls and abandoned baggage. Current battle precedes the subsequent siege. |
| Nisa 1428 | Fortified city, suburbs, river and church | Wall/gate kit and varied suburb houses. Lore distinguishes the suburb attack from capture of the entire city. |
| Domažlice 1431 | Baldov, town, wooded escape corridor, camp | Camp tents, baggage carts, dropped flags and abandoned guns can support the rout narrative. |
| Plzeň 1433–34 | City walls, St Bartholomew landmark, Mže, siege trenches/camp | Town kit, period-appropriate church variant, gun positions and camp. Camel is an optional lore prop, not a unit or necessary objective. |
| Lipany 1434 | Two wagon armies, Lipská hora, Hřiby village | Same wagon kit in clearly opposed appearances, both able to retain Hussite symbols. Barns optional village scenery; no need to stage disputed aftermath stories. |
| Sion 1437 | Rocky castle core, bailey, three defensive banks, Vrchlice and siege positions | Castle kit plus rock base, earthen banks/ditches and artillery positions. Do not reduce all defences to a single stone wall. |
| Hořice 1423 | Gothard hill, church, town and summit wagon position | Church, terrain, wagons and dismounted knight assets exist. The scenario’s charge-block event alone does not set the explicit dismount flag. |
| Malešov 1424 | Valley, Bohynka brook and fortified manor | Generic residential keep, gate, round tower, walls and palisade now placed at the labelled site. Stream crossing and slope composition remain. Stone-filled rolling wagons should not be a core asset requirement: repository lore flags the story as doubtful. |

## Reusable environment kit

| Kit | Proposed pieces | Priority |
| --- | --- | --- |
| Fortifications | Straight/corner walls, open gatehouse, square/round tower, timber palisade and manor keep complete. Rock foundations and further site-specific assemblies remain. | High: first two manor sites placed; castles and fortified towns still need authored arrangements. |
| Fieldworks | Blockhouse, low wall, earth bank, ditch, firing platform | High: Vítkov, Vyšehrad, Plzeň and Sion. Earthworks should follow terrain, not float above it. |
| Settlement | Two or three house variants, barn, shed, fence, courtyard/gate; monastery wing | Medium: current repeated farmhouse does not distinguish city, village and monastery. |
| Military camp | Small/large tent, baggage cart, barrels, sacks/crates, cooking fire, ammunition pile | Medium: sieges and routed armies; avoid clutter on playable positions. |
| Crossings and wetlands | Bridge end/approach, ford stones, reeds/rushes, bank rocks, shallow water/ice states | Medium: reuse current bridge and procedural water where possible. |
| Battlefield states | Empty/damaged wagon, abandoned gun, dropped shield/banner, smoke/fire | Later: reuse crewless wagon; most states can share intact assets. |
| Rural accents | Haystack, timber pile, hedges, orchard variation, well, livestock | Later: add only when composition benefits. Existing trees/grass already provide substantial coverage. |
| Lore-specific extras | Plzeň camel, optional cattle herd | Optional: clearly separate tradition and decorative context from historical/gameplay requirements. |

## Remaining work

Basic unit coverage and the first seven-piece fortification kit are finished. Environment work continues with rock foundations and terrain-following earthworks, settlement variety, camps, crossings and rural props, plus authored fortifications for the remaining battles. Nekmíř and Malešov have initial manor compositions; the other sixteen scenarios have not received this kit. The current blockhouse covers the playable fieldwork unit, not a complete siege landscape.

Unit refinements can follow separately: individual commander likenesses and heraldry, regional clothing/equipment, a lighter men-at-arms variant, planted pavises, braced spears, at-ease figures, loading/firing artillery crews and damaged props. These are additions to a complete baseline rather than missing representations of roster types.

## Evidence and verification

- Roster: `js/data/unitTypes.js`; scenario placements and labels: `js/data/scenarios.js`.
- Narrative context and uncertainty: `js/data/battleLore.js`; historical source registry: `js/data/historicalSources.js`.
- Actual model selection: `views/3d/src/unit-recipes.ts`; placement and appearance lifecycle: `views/3d/src/units.ts`.
- Loading/material reuse: sibling `assets.ts`; scenery coverage: `generated-scenery.ts`, `scenery.ts`, `landscape-details.ts`; authored map registration: `scenario-art.ts`.
- Asset descriptions and conventions: `tools/art/blender/README.md`; shared GLBs and manifests under `assets/3d/models/`; experimental exports under `experiments/sudomer-diorama/assets/models/`.

The original inventory checked live source definitions, the original 27 GLB JSON headers/material/animation lists, and the renderer mappings. The first infantry batch subsequently added three models with linked visual/historical references, inspected Blender previews and an exported-model comparison in both side colours. GLB loading, dimensions, grounding, static geometry, faction material isolation and unit mappings have automated coverage; the 3D build and browser formation checks passed. The artillery batch also passed exported-geometry checks for open muzzles, ground contact and the combined gun/crew picking footprint, followed by browser rendering and selection checks. The spear/bow pair passed the same export and browser checks, including the height of the raised spear tips within the picking volume. Cavalry checks also cover static exports, four planted hooves, all eight mappings and the full geometry of two-mount formations within the selectable area. The final pass loads all 59 roster definitions with real GLBs, checks figure counts and independent standards, and exercises dismounted states. Full project checks, 90 renderer tests, the build and browser transition checks passed. Battle-specific architectural details remain research work before modelling.

The first environment batch adds exported-geometry checks for the open gate passage, grounded static models and triangle budgets. Its two manor compositions are checked against the real scenario labels, with clearance around hex centres, normal explored-cell fog visibility and fallback when the expected town terrain changes. All 93 renderer tests, the build and GLB validation passed; Blender previews and both manor layouts were inspected in the integrated browser, including fog and selection beside the walls. The broader gameplay suite was not rerun for this scenery-only batch; rules and scenario data were unchanged.

## Complete roster mapping

This appendix records the current Three.js base-model selection, not whether that selection is suitable. Each commander also has a `commander_standard`; artillery adds two `artillery_gunner` figures. H/C are the definition's default faction; scenario-side assignment may differ.

| Type | Name | Default side | Current model |
| --- | --- | --- | --- |
| `CEPNICI` | Cepníci | H | `infantry_flail` |
| `SUDLICNICI` | Sudličníci | H | `infantry_polearm` |
| `PAVEZNICI` | Pavézníci | H | `infantry_pavise` |
| `KOPINICI_HUSITI` | Kopiníci | H | `infantry_spear` |
| `KUSINICI_HUSITI` | Kušiníci | H | `infantry_crossbow` |
| `RUCNICARI` | Ručničáři | H | `infantry_handgun` |
| `HOUFNICE` | Houfnice | H | `artillery_houfnice` + `artillery_gunner` |
| `TARASNICE` | Tarasnice | H | `artillery_tarasnice` + `artillery_gunner` |
| `POLNI_OPEVNENI` | Posádka srubu | H | `field_blockhouse` |
| `VOZOVA_HRADBA` | Bojový vůz | H | `war_wagon` |
| `JIZDA_HUSITI` | Lehká jízda | H | `cavalry_light` |
| `SLECHTICKA_JIZDA_HUSITI` | Šlechtická jízda | H | `cavalry_heavy` |
| `POUTNICI` | Poutníci | H | `civilian_adult` + `civilian_woman` + `civilian_child` |
| `ZVED` | Zvěd | H | `cavalry_scout` |
| `TEZKY_RYTIR` | Těžký rytíř | C | `cavalry_heavy` |
| `TEZKOODENCI` | Těžkooděnci | C | `cavalry_heavy` |
| `LEHKA_JIZDA` | Lehká jízda | C | `cavalry_light` |
| `ZVED_KRIZACI` | Zvěd | C | `cavalry_scout` |
| `KOPINICI` | Kopiníci | C | `infantry_spear` |
| `HALAPARTNICI` | Halapartníci | C | `infantry_halberd` |
| `PAVEZNICI_KRIZACI` | Pavézníci | C | `infantry_pavise` |
| `KUSNICI_JANOV` | Janovští kušiníci | C | `infantry_crossbow` |
| `KUSNICI` | Kušiníci | C | `infantry_crossbow` |
| `LUCISTNICI` | Lučištníci | C | `infantry_archer` |
| `BOMBARDA` | Bombarda | H | `artillery_bombard` + `artillery_gunner` |
| `POLNI_DELO` | Polní dělo | C | `artillery_tarasnice` + `artillery_gunner` |
| `ZOLDNERI` | Žoldnéři | C | `infantry_shield` |
| `JAN_ZIZKA` | Jan Žižka | H | `commander_captain` |
| `PROKOP_HOLY` | Prokop Holý | H | `commander_cleric` |
| `JAN_ZELIVSKY` | Jan Želivský | H | `commander_cleric` |
| `VACLAV_KORANDA` | Václav Koranda | H | `commander_cleric` |
| `ZATECKY_HEJTMAN` | Žatecký hejtman | H | `commander_captain` |
| `JAN_ROHAC` | Jan Roháč z Dubé | H | `commander_noble` |
| `FRIDRICH_MISNENSKY` | Fridrich IV. Bojovný | C | `commander_noble` |
| `BOHUSLAV_SVAMBERK` | Bohuslav ze Švamberka | C | `commander_noble` |
| `ZIKMUND` | Zikmund Lucemburský | C | `commander_noble` |
| `FILIPPO_SCOLARI` | Filippo Scolari | C | `commander_noble` |
| `HEINRICH_ISENBURG` | Heinrich z Isenburgu | C | `commander_noble` |
| `ERKINGER_SEINSHEIM` | Erkinger ze Seinsheim | C | `commander_noble` |
| `FRIDRICH_SASKY` | Fridrich Saský | C | `commander_noble` |
| `BOSO_VITZTHUM` | Boso z Vitzthumu | C | `commander_noble` |
| `PETR_STERNBERK` | Petr ze Šternberka | C | `commander_noble` |
| `VILEM_SVIHOVSKY` | Vilém Švihovský | C | `commander_noble` |
| `BRENEK_SVIHOVSKY` | Břeněk Švihovský | H | `commander_noble` |
| `HYNEK_NEKMIRE` | Hynek z Nekmíře | C | `commander_noble` |
| `HYNEK_KRUSINA` | Hynek Krušina | H | `commander_noble` |
| `JINDRICH_PLUMOV` | Jindřich z Plumlova | C | `commander_noble` |
| `DIVIS_BOREK` | Diviš Bořek | H | `commander_noble` |
| `CENEK_VARTENBERK` | Čeněk z Vartenberka | C | `commander_noble` |
| `ARNOST_FLASKA` | Arnošt Flaška | C | `commander_noble` |
| `JINDRICH_BERKA` | Jindřich Berka z Dubé | C | `commander_noble` |
| `JAN_HVEZDA` | Jan Hvězda z Vícemilic | H | `commander_captain` |
| `HYNEK_PODEBRADY` | Hynek z Poděbrad | H | `commander_noble` |
| `VIKTORIN_BOCEK` | Viktorín Boček | H | `commander_noble` |
| `VOZOVA_HRADBA_PRASKY` | Pražské vozy | C | `war_wagon` |
| `CEPNICI_PRASKY` | Pražští cepníci | C | `infantry_flail` |
| `KUSINICI_PRASKY` | Pražští kušiníci | C | `infantry_crossbow` |
| `HOUFNICE_PRASKY` | Pražské houfnice | C | `artillery_houfnice` + `artillery_gunner` |
| `JIZDA_PRASKY` | Pražská jízda | C | `cavalry_light` |
