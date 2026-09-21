# Model inventory and remaining needs

Read when planning 3D assets, faction appearance, or scenery for another battle.

Inventory date: 21 September 2026. Scope: this checkout's canonical unit/scenario data and the Three.js renderer in `views/3d`. “Available” means a GLB exists; it does not necessarily mean the renderer uses it or that its appearance has passed visual review. This is an asset-planning inventory, not a new historical audit.

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

There are **27 GLB files**, **59 unit definitions**, and **18 scenarios**. The 27 exports include alternative vegetation and experimental variants; they are not 27 distinct gameplay unit models. Current troop presentation uses five base models: polearm infantry, handgun infantry, shield infantry, cavalry, and war wagon, plus a commander banner.

The biggest omissions are recognisable flails, crossbows, bows, pavises, artillery, pilgrims, field fortifications, and distinct light/heavy cavalry. Some missing coverage needs only a renderer mapping or a material variant; other types require new geometry.

### Available model files

Shared paths below are relative to `assets/3d/models/`. The six `battle/` and `benchmark/` variants remain under `experiments/sudomer-diorama/assets/models/`; they are available experimental exports, not production mappings. Shared logical IDs are resolved by `assets/3d/model-paths.json`.

| Files | Count | What we have / limits |
| --- | ---: | --- |
| `units/infantry_polearm.glb` | 1 | Red-coated soldier, kettle helmet, polearm. Useful for sudličníci; currently also the catch-all for unrelated types. |
| `units/infantry_handgun.glb` | 1 | Ochre-coated handgunner with powder flask. Used for ručničáři and, incorrectly as a visual identity, Koranda. |
| `units/infantry_shield.glb` | 1 | Sword and shield with pale cross. Not a crossbowman or a dedicated large-pavise bearer. |
| `units/cavalry.glb` | 1 | Horse and polearm rider. One `HorseWalk` animation; no distinct scout, light cavalry, or armoured knight model. |
| `units/war_wagon.glb` | 1 | Defensive wagon with two crew, wheels, towing poles, stakes and chalice flag. |
| `props/banner.glb` | 1 | Red cloth with pale chalice; currently added to every commander, including opponents. |
| `buildings/church.glb`, `buildings/farmhouse.glb`, `props/bridge.glb`, `props/stakes.glb` | 4 | Generic church, house, timber bridge and crossed timber obstacle. No castle or town-wall kit. |
| `vegetation/broadleaf_olive.glb`, `vegetation/broadleaf_gold.glb`, `vegetation/cypress.glb` | 3 | Original stylized vegetation. |
| `vegetation/sudomer/tree-a.glb`, `vegetation/sudomer/tree-b.glb`, `vegetation/sudomer/tree-c.glb`, `vegetation/sudomer/shrub.glb` | 4 | Separate Sudoměř vegetation set. |
| `vegetation/procedural-worlds/pw_deciduous_01.glb`, `vegetation/procedural-worlds/pw_deciduous_02.glb`, `vegetation/procedural-worlds/pw_deciduous_03.glb`, `vegetation/procedural-worlds/pw_shrub_01.glb` | 4 | Additional vegetation; generated battle scenery currently selects deciduous 02. |
| `battle/unarmed_adult_static.glb` | 1 | Existing civilian starting point; not mapped to `POUTNICI` in Three.js. |
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

Only Sudoměř has an authored scenario-art manifest registered. Other scenarios use terrain-derived scenery: forest → tree, town → farmhouse, church → church, trenches → stakes. Consequently a labelled castle, fortified city or monastery is not yet a matching landmark simply because its tile receives a building.

## Unit models to add or adapt

| Visual family | Unit types covered | Current situation | Needed |
| --- | --- | --- | --- |
| Flail infantry | `CEPNICI`, `CEPNICI_PRASKY` | Polearm fallback | Flail weapon and readable carrying/ready pose; reuse infantry body. |
| Polearm infantry | `SUDLICNICI`, `HALAPARTNICI` | Existing polearm | Different weapon heads and appropriate side colours. |
| Spearmen | `KOPINICI_HUSITI`, `KOPINICI` | Polearm fallback | Straight spear/long spear silhouette; shared body. |
| Pavise infantry | `PAVEZNICI`, `PAVEZNICI_KRIZACI` | Polearm fallback, despite shield model existing | Large pavise with distinct silhouette and side-specific decoration. |
| Crossbowmen | `KUSINICI_HUSITI`, `KUSNICI`, `KUSNICI_JANOV`, `KUSINICI_PRASKY` | First two use sword/shield; others polearm | Crossbow and bolt quiver; optional Genoese equipment variation after reference checking. |
| Handgunners | `RUCNICARI` | Matching base model | Cloth variants; optional weapon variation. |
| Archers | `LUCISTNICI` | Polearm fallback | Bow, quiver and pose. |
| Mercenary infantry | `ZOLDNERI` | Polearm fallback | Reuse sword/shield body with equipment variation; no unique body required initially. |
| Light cavalry | `JIZDA_HUSITI`, `LEHKA_JIZDA`, `JIZDA_PRASKY` | Only first explicitly maps to cavalry | Map all to horse/rider; lighter equipment and side variants. |
| Scouts | `ZVED`, `ZVED_KRIZACI` | Polearm fallback | Light rider variant with simpler equipment; distinct small pennant or silhouette. |
| Heavy cavalry | `SLECHTICKA_JIZDA_HUSITI`, `TEZKY_RYTIR`, `TEZKOODENCI` | Last two use generic cavalry; first falls back | Armoured rider/lance variant, optional horse cloth; mounted and dismounted versions. |
| Field artillery | `HOUFNICE`, `HOUFNICE_PRASKY`, `TARASNICE`, `POLNI_DELO` | Polearm fallback | Short-barrel and long-barrel gun/carriage variants; small reusable crew. |
| Siege artillery | `BOMBARDA` | Polearm fallback | Heavy barrel, timber bed, ammunition and crew. Definition currently belongs to `hussites`; do not infer its side from its name. |
| War wagons | `VOZOVA_HRADBA`, `VOZOVA_HRADBA_PRASKY` | Only first uses wagon | Map Prague variant; recolour cloth/flags while preserving chalice identity where appropriate. |
| Fieldwork garrison | `POLNI_OPEVNENI` | Polearm fallback | Timber blockhouse, low defensive wall, firing positions and garrison. Stakes alone do not cover Vítkov. |
| Pilgrims | `POUTNICI` | Armed polearm fallback | Integrate existing unarmed adult; add varied civilian clothing, bundles and group silhouettes, including women/children if represented. |
| Commanders | All 27 commander definitions; full list below | Žižka/Švamberk use shield infantry; Koranda handgunner; other 24 polearm. All receive chalice banner. | Shared captain, armoured noble and cleric bases; distinctive accessories/banners. Bespoke portraits/models can follow later. |

Mounted/dismounted heavy infantry is particularly useful for the Sudoměř and Hořice narratives. It is a visual-state requirement, not necessarily a new recruitable unit. Likewise routing, marching, damaged wagons and abandoned guns can be poses or prop states rather than entirely new models.

## Sides, colours and heraldry

Keep **game side**, **historical affiliation**, and **unit equipment** separate. The data uses two gameplay factions, `hussites` and `crusaders`, but the second can represent Prague/moderate Hussites or another coalition. Lipany explicitly defines blue Prague variants. A blue Hussite wagon should not automatically receive a crusader cross.

The current Three.js presenter uses faction to choose facing, but does not recolour troop materials. Red coats and chalice flags are embedded in the available models. Merely duplicating the same GLB does not produce a readable opposing army.

Proposed art scheme, not a claim about historical uniforms:

| Layer | Proposed coverage |
| --- | --- |
| Immediate side recognition | Muted red vs muted blue cloth accents, plus a small formation marker with differing symbol/shape. Keep neutral cloth, leather, wood and metal shared. |
| Hussite identity | Chalice shield/flag variants; optional distinctions between field armies, Prague and allied nobles only where scenario data supports them. |
| Catholic/royal/crusading identity | Appropriate cross, royal or noble banner variants. Verify specific heraldry before making named historical claims. |
| Hussite civil conflicts | Chalices on both sides where appropriate, with opposing side accents and commander standards. |
| Individual leaders | Cleric versus noble versus field captain silhouettes; Žižka-specific head/weapon detail after reference review; heraldic shields as interchangeable parts. |
| Variation within a formation | A few neutral coat colours, helmet/head variants, shield designs and horse coats. Avoid making every person look uniformly dressed. |

Use a small number of shared meshes with interchangeable weapons, shields, headgear, cloth materials and flag designs. Clone/cache materials per appearance variant before recolouring: `clone(true)` currently shares materials, so changing a shared coat material could recolour both armies.

## Battle surroundings and distinctive props

These are candidates derived from current map labels, terrain and battle lore. They are not verified reconstructions of medieval architecture. Generic kits can establish a readable scene; named landmarks require period references before detailed modelling. Modern castle/church appearances should not be copied unquestioningly.

| Scenario | Main scenery need | Available foundation / remaining gap |
| --- | --- | --- |
| Živohošť 1419 | Červenka hill, Vltava ford, pilgrim procession | Terrain/trees exist; add ford treatment and civilians. Lore explicitly excludes a wagon fort here. |
| Nekmíř 1419 | Small fortified manor at Nekmíř, road and wagon position | House/wagon exist; manor walls, gate and defensible residence missing. Exact battlefield layout uncertain. |
| Sudoměř 1420 | Pond, drained muddy basin, narrow embankment, wagon line | Strongest existing authored coverage. Prioritise civilians, dismounted knights, faction variants and optional reeds/pond-edge details; no castle needed for the central scene. |
| Vítkov 1420 | Narrow ridge, timber blockhouses and defensive wall | Terrain exists; dedicated fieldworks missing. Prague skyline could be distant context, not a substitute for the ridge defences. |
| Vyšehrad 1420 | Fortress, Vltava/Botič, Pankrác plain, Podolí slope, siege lines | Generic church/house/stakes insufficient for fortress identity. Add walls, towers, gates and earthworks. |
| Žatec 1421 | Fortified town on promontory, Ohře, western attack front | Town wall/gate/tower kit, dense houses and besiegers' camp. Optional camp-fire state from scenario events. |
| Kutná Hora 1421 | Town, Kaňk hill, roads and breakout route | Town kit and winter/night scene treatment. Cattle are optional tradition-related scenery, not a required combat unit. |
| Německý Brod 1422 | Town, Sázava crossing, bridge and ice | Timber bridge exists but generic scenery does not automatically place it at this crossing. Add crossing placement and readable intact/broken-ice surface states. |
| Most 1421 | Hněvín castle, town, monastery | Hilltop castle assembly and monastery compound missing; reuse church only as a generic starting piece. |
| Ústí 1426 | Na Běhání slope, double wagon line, distant town | Reuse wagon/terrain; extend town backdrop. Maintain separation between the two wagon rows. |
| Tachov 1427 | Town edge, roads toward Bavaria/Stříbro, retreating camp | Reuse terrain/houses; add gate/walls and abandoned baggage. Current battle precedes the subsequent siege. |
| Nisa 1428 | Fortified city, suburbs, river and church | Wall/gate kit and varied suburb houses. Lore distinguishes the suburb attack from capture of the entire city. |
| Domažlice 1431 | Baldov, town, wooded escape corridor, camp | Camp tents, baggage carts, dropped flags and abandoned guns can support the rout narrative. |
| Plzeň 1433–34 | City walls, St Bartholomew landmark, Mže, siege trenches/camp | Town kit, period-appropriate church variant, gun positions and camp. Camel is an optional lore prop, not a unit or necessary objective. |
| Lipany 1434 | Two wagon armies, Lipská hora, Hřiby village | Same wagon kit in clearly opposed appearances, both able to retain Hussite symbols. Barns optional village scenery; no need to stage disputed aftermath stories. |
| Sion 1437 | Rocky castle core, bailey, three defensive banks, Vrchlice and siege positions | Castle kit plus rock base, earthen banks/ditches and artillery positions. Do not reduce all defences to a single stone wall. |
| Hořice 1423 | Gothard hill, church, town and summit wagon position | Existing church/terrain/wagons; dismounted armoured troops are the main unit gap. |
| Malešov 1424 | Valley, Bohynka brook and fortified manor | Manor kit, stream crossing and slope composition. Stone-filled rolling wagons should not be a core asset requirement: repository lore flags the story as doubtful. |

## Reusable environment kit

| Kit | Proposed pieces | Priority |
| --- | --- | --- |
| Fortifications | Straight/corner wall sections, gatehouse, square/round tower, timber palisade, manor keep, rock foundation | High: covers castles, manors and fortified towns across many maps. Build site-specific assemblies from shared pieces. |
| Fieldworks | Blockhouse, low wall, earth bank, ditch, firing platform | High: Vítkov, Vyšehrad, Plzeň and Sion. Earthworks should follow terrain, not float above it. |
| Settlement | Two or three house variants, barn, shed, fence, courtyard/gate; monastery wing | Medium: current repeated farmhouse does not distinguish city, village and monastery. |
| Military camp | Small/large tent, baggage cart, barrels, sacks/crates, cooking fire, ammunition pile | Medium: sieges and routed armies; avoid clutter on playable positions. |
| Crossings and wetlands | Bridge end/approach, ford stones, reeds/rushes, bank rocks, shallow water/ice states | Medium: reuse current bridge and procedural water where possible. |
| Battlefield states | Empty/damaged wagon, abandoned gun, dropped shield/banner, smoke/fire | Later: reuse crewless wagon; most states can share intact assets. |
| Rural accents | Haystack, timber pile, hedges, orchard variation, well, livestock | Later: add only when composition benefits. Existing trees/grass already provide substantial coverage. |
| Lore-specific extras | Plzeň camel, optional cattle herd | Optional: clearly separate tradition and decorative context from historical/gameplay requirements. |

## Suggested production order

1. **Make current units readable:** fix type-to-model mappings, integrate the unarmed adult, establish two side appearances and replace the universal commander chalice. This unlocks existing assets before new modelling.
2. **Fill major weapon silhouettes:** flail, crossbow, bow, spear, pavise; then light/heavy/scout riders. Share bodies and horse geometry.
3. **Add guns and fieldworks:** houfnice, tarasnice/field-gun variants, bombarda and a Vítkov blockhouse. These are currently represented by ordinary soldiers.
4. **Build one modular fortification kit:** use it for Nekmíř/Malešov, town walls, Hněvín/Vyšehrad and Sion, with individually authored placement and a few landmark parts.
5. **Add civilian/commander variety and camps**, followed by scene-specific atmosphere and optional lore props.

No need to commission 59 bespoke troop meshes or 18 completely separate scenery sets. Count production work by shared visual families, attachment variants and landmark assemblies. Before accepting an asset, check its silhouette at gameplay zoom, both side appearances, orientation/scale, footprint, and clarity against neighbouring units.

## Evidence and verification

- Roster: `js/data/unitTypes.js`; scenario placements and labels: `js/data/scenarios.js`.
- Narrative context and uncertainty: `js/data/battleLore.js`; historical source registry: `js/data/historicalSources.js`.
- Actual model selection: `views/3d/src/units.ts`.
- Loading/material reuse: sibling `assets.ts`; scenery coverage: `generated-scenery.ts`, `scenery.ts`, `landscape-details.ts`; authored map registration: `scenario-art.ts`.
- Asset descriptions and conventions: `tools/art/blender/README.md`; shared GLBs and manifests under `assets/3d/models/`; experimental exports under `experiments/sudomer-diorama/assets/models/`.

Checked live source definitions, all 27 GLB JSON headers/material/animation lists, and the renderer mappings. No new visual QA, historical web research, game build or runtime test was performed for this documentation-only inventory. Battle-specific architectural details remain research work before modelling.

## Complete roster mapping

This appendix records the current Three.js base-model selection, not whether that selection is suitable. Commander banners are additional to the listed base model. H/C are the definition's default faction; scenario-side assignment may differ.

| Type | Name | Default side | Current model |
| --- | --- | --- | --- |
| `CEPNICI` | Cepníci | H | `infantry_polearm` |
| `SUDLICNICI` | Sudličníci | H | `infantry_polearm` |
| `PAVEZNICI` | Pavézníci | H | `infantry_polearm` |
| `KOPINICI_HUSITI` | Kopiníci | H | `infantry_polearm` |
| `KUSINICI_HUSITI` | Kušiníci | H | `infantry_shield` |
| `RUCNICARI` | Ručničáři | H | `infantry_handgun` |
| `HOUFNICE` | Houfnice | H | `infantry_polearm` |
| `TARASNICE` | Tarasnice | H | `infantry_polearm` |
| `POLNI_OPEVNENI` | Posádka srubu | H | `infantry_polearm` |
| `VOZOVA_HRADBA` | Bojový vůz | H | `war_wagon` |
| `JIZDA_HUSITI` | Lehká jízda | H | `cavalry` |
| `SLECHTICKA_JIZDA_HUSITI` | Šlechtická jízda | H | `infantry_polearm` |
| `POUTNICI` | Poutníci | H | `infantry_polearm` |
| `ZVED` | Zvěd | H | `infantry_polearm` |
| `TEZKY_RYTIR` | Těžký rytíř | C | `cavalry` |
| `TEZKOODENCI` | Těžkooděnci | C | `cavalry` |
| `LEHKA_JIZDA` | Lehká jízda | C | `infantry_polearm` |
| `ZVED_KRIZACI` | Zvěd | C | `infantry_polearm` |
| `KOPINICI` | Kopiníci | C | `infantry_polearm` |
| `HALAPARTNICI` | Halapartníci | C | `infantry_polearm` |
| `PAVEZNICI_KRIZACI` | Pavézníci | C | `infantry_polearm` |
| `KUSNICI_JANOV` | Janovští kušiníci | C | `infantry_polearm` |
| `KUSNICI` | Kušiníci | C | `infantry_shield` |
| `LUCISTNICI` | Lučištníci | C | `infantry_polearm` |
| `BOMBARDA` | Bombarda | H | `infantry_polearm` |
| `POLNI_DELO` | Polní dělo | C | `infantry_polearm` |
| `ZOLDNERI` | Žoldnéři | C | `infantry_polearm` |
| `JAN_ZIZKA` | Jan Žižka | H | `infantry_shield` |
| `PROKOP_HOLY` | Prokop Holý | H | `infantry_polearm` |
| `JAN_ZELIVSKY` | Jan Želivský | H | `infantry_polearm` |
| `VACLAV_KORANDA` | Václav Koranda | H | `infantry_handgun` |
| `ZATECKY_HEJTMAN` | Žatecký hejtman | H | `infantry_polearm` |
| `JAN_ROHAC` | Jan Roháč z Dubé | H | `infantry_polearm` |
| `FRIDRICH_MISNENSKY` | Fridrich IV. Bojovný | C | `infantry_polearm` |
| `BOHUSLAV_SVAMBERK` | Bohuslav ze Švamberka | C | `infantry_shield` |
| `ZIKMUND` | Zikmund Lucemburský | C | `infantry_polearm` |
| `FILIPPO_SCOLARI` | Filippo Scolari | C | `infantry_polearm` |
| `HEINRICH_ISENBURG` | Heinrich z Isenburgu | C | `infantry_polearm` |
| `ERKINGER_SEINSHEIM` | Erkinger ze Seinsheim | C | `infantry_polearm` |
| `FRIDRICH_SASKY` | Fridrich Saský | C | `infantry_polearm` |
| `BOSO_VITZTHUM` | Boso z Vitzthumu | C | `infantry_polearm` |
| `PETR_STERNBERK` | Petr ze Šternberka | C | `infantry_polearm` |
| `VILEM_SVIHOVSKY` | Vilém Švihovský | C | `infantry_polearm` |
| `BRENEK_SVIHOVSKY` | Břeněk Švihovský | H | `infantry_polearm` |
| `HYNEK_NEKMIRE` | Hynek z Nekmíře | C | `infantry_polearm` |
| `HYNEK_KRUSINA` | Hynek Krušina | H | `infantry_polearm` |
| `JINDRICH_PLUMOV` | Jindřich z Plumlova | C | `infantry_polearm` |
| `DIVIS_BOREK` | Diviš Bořek | H | `infantry_polearm` |
| `CENEK_VARTENBERK` | Čeněk z Vartenberka | C | `infantry_polearm` |
| `ARNOST_FLASKA` | Arnošt Flaška | C | `infantry_polearm` |
| `JINDRICH_BERKA` | Jindřich Berka z Dubé | C | `infantry_polearm` |
| `JAN_HVEZDA` | Jan Hvězda z Vícemilic | H | `infantry_polearm` |
| `HYNEK_PODEBRADY` | Hynek z Poděbrad | H | `infantry_polearm` |
| `VIKTORIN_BOCEK` | Viktorín Boček | H | `infantry_polearm` |
| `VOZOVA_HRADBA_PRASKY` | Pražské vozy | C | `infantry_polearm` |
| `CEPNICI_PRASKY` | Pražští cepníci | C | `infantry_polearm` |
| `KUSINICI_PRASKY` | Pražští kušiníci | C | `infantry_polearm` |
| `HOUFNICE_PRASKY` | Pražské houfnice | C | `infantry_polearm` |
| `JIZDA_PRASKY` | Pražská jízda | C | `infantry_polearm` |
