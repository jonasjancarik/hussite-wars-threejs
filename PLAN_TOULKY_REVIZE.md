# Revize scénářů vůči pramenům (Toulky + Dolejší)

> Archiv staršího plánu. Historická revize ze září 2026 jej v několika bodech
> nahrazuje: zejména kamenné vozy u Malešova, „divadelní“ obléhání Sionu,
> automatická žízeň bez studny a nekriticky přebírané citace. Aktuální rozhodnutí
> jsou v [docs/HISTORICAL_AUDIT.md](docs/HISTORICAL_AUDIT.md) a v poznámkách scénářů.

Průběžná konfrontace 10 dosud neprojetých bitev proti Toulkám českou minulostí (kotva) a Dolejšímu (Husité). Cíl: sesbírat návrhy úprav, pak je odbavovat po dávkách podle kategorie.

## Legenda kategorií
- **📜 TRIVIA / lore** — battleLore trivia, citáty, texty briefingu/debriefingu/eventů. Bezpečné, přidávací, i opravy nepřesností. → aplikovat dávkově.
- **⚙️ MECHANIKA – strukturální** — trvalé herní pravdy nezávislé na balancu (terén, jednotky/velitelé, logika vítězství, special mechanics, deployment, značky zón). → dělat teď.
- **🎚️ MECHANIKA – balanc** — počty jednotek, HP/útok, limity kol, obtížnost. → PARK do předělání AI.

## Souhrn
| Bitva | 📜 | ⚙️ | 🎚️ | Stav |
|---|---|---|---|---|
| Most (1421) | 6 | 2 | 1 | ✅ navrženo |
| Hořice (1423) | 6 | 2 | 1 | ✅ navrženo |
| Malešov (1424) | 6 | 1 | 0 | ✅ navrženo |
| Ústí (1426) | 7 | 0 | 1 | ✅ navrženo |
| Tachov (1427) | 7 | 1 | 1 | ✅ navrženo |
| Nisa (1428) | 6 | 0 | 0 | ✅ navrženo |
| Domažlice (1431) | 7 | 0 | 1 | ✅ navrženo |
| Plzeň (1433) | 5 | 1 | 1 | ✅ navrženo |
| Lipany (1434) | 6 | 1 | 1 | ✅ navrženo |
| Sion (1437) | 6 | 1 | 0 | ✅ navrženo |

---

## Syntéza pro odbavení (10/10 hotovo)
Celkem **~62 📜 trivia · 9 ⚙️ strukturálních · 7 🎚️ balanc**. Návrh, jak to rozdělit do dávek:

**A) ⚙️ STRUKTURÁLNÍ „dělat teď" — ✅ HOTOVO (commits cb41a28 + 2bca414):**
- ✅ **Vytvořen chybějící battleLore** pro `plzen` a `sion` (CZ báze + EN overlay + mapování).
- ✅ **Malešov: swap `HYNEK_PODEBRADY` → `VIKTORIN_BOCEK`**.
- ✅ **Event-beaty** (nakonec balance-neutrálně, jen narativ/text — mechanické debuffy přesunuty do balancu): Most = zásah koně praporečníka (kolo 5); Lipany = odjezd Bedřicha ze Strážnice s 300 jezdci; Tachov = rout text s chorálem; Hořice = text o nuceném sesednutí. *(Pozn.: plný `panic`/`dismount` debuff NEudělán záměrně — je to balanc-park.)*

**B) 📜 OPRAVY nepřesností — ✅ HOTOVO (commit d064b14):**
- Malešov: „Hynek Boček z Poděbrad (zajat)" mezi nepřáteli → byl s Žižkou; ztráty 1 400 „z OBOU stran".
- Domažlice: „8 000 vozů ukořistěno" → ~2 000 + 300 děl (9 000 byl jen plán).
- Nisa: velitel Prokop (ne Velek); „2 000 pobito NEBO utopeno"; nahradit anglický citát.
- Hořice: Flaška „padl" → prameny „porazil"; „Mikšík z Úlibic" nedoložen.
- Lipany: „700–900 upáleno ve stodolách" → Toulky mají jen ~700 zajato; přeformulovat na tradici, ne jistotu.
- Tachov: příčina paniky — harcovníci ODRAŽENI, ne „odmítli".

**C) 📜 OBOHACENÍ — ✅ HOTOVO kurátorsky (commit 8c86ead):**
9 perel do 7 bitev (Kamrovec/Krvavá ulička, Fedor z Ostrogu, chorál 7 km + Cesariniho relikvie, Kozojedy + Žižkova výzva, Minstrberk výpalné, Turkovec s korouhví, nedisciplína u Mostu). Plzeň/Sion/Lipany už obohaceny v bucketu A. *(Velbloud, Sion-archeologie, Bedřich = udělány v A.)*

**D) ⚠️ DESIGN TENZE — ✅ VYŘEŠENO defaultně už v bucketu A:**
- **Tachov chorál** → jen text (ne plná mechanika) — Domažlice zůstávají unikátní. HOTOVO.
- **Sion „divadlo"** → revizionistická archeologická pochybnost je v battleLore/trivia, hrdinský tón scénáře ponechán. HOTOVO.
- *(Kdyby chtěl Josef některé rozhodnutí obrátit — plný chorál u Tachova, nebo Sion víc jako frašku — je to jednorázová změna.)*

**E) 🎚️ BALANC — vše PARK do AI** (přesily, poměry jednotek). Neinvestovat teď.

---

<!-- Sekce jednotlivých bitev se plní průběžně -->

## Most (5. 8. 1421) — `most_1421`
**Prameny:** Toulky díl 219 „Hra na vítěze a poražené" + Dolejší. Hra = dual-objective (dobij Hněvín NEBO drž bránu), difficulty 4, maxTurns 10.

**Co už sedí (nechat):** nabídnutá kapitulace + Želivského odmítnutí (event kola 1 přesně dle pramene ✓); Fridrich jako reliéf ze severu ✓; Žižka nepřítomen (zotavuje se) ✓; „první velká porážka", oslabení Želivského ✓; útok do svahu bez hradby ✓. Boční úder mosteckých: Toulky výpad nezmiňují, Dolejší „cizácké oddíly se spojují s domácí opozicí" → hratelná dramatizace, obhajitelné, NECHAT.

### 📜 TRIVIA / lore
1. **Kůň praporečníka**: zásah koně husitského praporečníka spustil zmatek → panika (Toulky). Nejlepší nový beat — viz i ⚙️1.
2. **Nedisciplína před bitvou**: vojáci si už dělili kořist, podcenili německou jízdu (Toulky).
3. **Noční útěk**: panický ústup v noci, zanechali praky, děla i zbroj; prchali až do Žatce, Chomutova, Loun i Slaného (Toulky + Dolejší).
4. **Roztržka Želivský × Žižka**: porážka zavdala příčinu rozporům (Dolejší) → aftermath.
5. **Žižkova trestná výprava**: Míšňané ustoupili ze země jen na ZPRÁVU o Žižkově příchodu (oba prameny) → debriefing/aftermath.
6. **Cesta k Mostu**: před Mostem vypálili Doksany a Osek, obsadili Teplice, dobyli Duchcov a 13. 7. Bílinu (Dolejší) → briefing kontext. + oprava composition: „2 praky a 2 velká děla" (Toulky; hra má „2 pušky, 2 praky") + ztráty ~400 mužů (Dolejší; hra „~500+").

### ⚙️ MECHANIKA – strukturální
1. **Noční přepad / zaskočení**: míšeňští udeřili V NOCI z 5. na 6. 8., husité „zaskočeni, přinuceni přijmout polní bitvu" (Dolejší). Hra Fridricha ohlašuje eventy dopředu (turn 5-6) — bez momentu překvapení. Návrh: při příchodu Fridricha `morale_drop`/`panic` event na husity s textem o koni praporečníka (mechanismus už existuje, viz Žatec/KH). Levné, věrné, nemění design scénáře.
2. **Zbraně obléhání**: hra na poli má 1 HOUFNICI; pramen 2 praky + 2 děla. Volitelné: druhé obléhací dělo/prak v deploymenti (drobnost, spíš kosmetika — může spadnout i pod 🎚️).

### 🎚️ MECHANIKA – balanc (PARK do AI)
1. dual-objective okna (drž 6 kol / maxTurns 10), difficulty 4 — nechat, přehodnotit po AI.

**Pozn. k prameni:** historka od Ramphold z Gorenze (purkrabí prý nechal zastřelit vlastního syna, aby nepadl do zajetí) — fetch ji vrátil zkomoleně, nepoužívat bez ověření.

## Hořice (20. 4. 1423) — `horice_1423`
**Prameny:** Toulky díl 224 „Kterak slepý hejtman válčil" + Dolejší (bohatá pasáž). Hra = field_battle na Gothardu, 5 fází, destroy_percent 60 %.

**Co už sedí (hodně):** Gothard + hradba na temeni ✓; **3 000 mužů a 120 vozů v lore PŘESNĚ dle Dolejšího** ✓; Diviš Bořek ✓; Čeněk + Flaška + Berka ve scénáři ✓ (Dolejší velení: Čeněk + Flaška; Berka z Toulek); svah blokuje jízdu (`cavalry_charge_blocked`) ✓; protiútok „čerstvých lidí" z kopce ✓; ukořistění děl ✓; datum 20. 4. ✓ (Dolejší: někdy uváděno 23. 4.).

### 📜 TRIVIA / lore
1. **Citát — Žižkův list-výzva před tažením** (Dolejší cituje celý): „Jenom mějte chléb, pivo, obrok koňům připravený… Pomněte na náš první boj, který jste malí proti velikým… bojovali. …buďte hotovi!" → battleLore.quotes.
2. **Citát — letopisec o sesedání**: „Když potom páni sesedali z koní…, měli na sobě víc zbroje než pěší… byli již unavení a Žižka na ně čekal s děly a lidmi neunavenými a bil je, jak chtěl." → quotes.
3. **ROZPOR padlých (oprava):** scénář event „Arnošt Flaška padl v boji!" — prameny říkají „porazil", ne padl (Toulky: Čeňka i Arnošta „porazil", Čeněk „utekl s málem lidu"). battleLore navíc jmenuje padlého „Mikšíka z Úlibic" — v našich pramenech NEdoložen. Návrh: event přeformulovat („Houf Arnošta Flašky se hroutí!" + morale_drop zůstane), do lore commanders přidat Flašku, Mikšíka označit/vypustit.
4. **Kontext Valečovští**: Žižka podporoval bratry Bartoše a Bernarta z Valečova v rozepři s Čeňkem (Toulky; Dolejší je potvrzuje jako věrné spojence) → briefing.
5. **Kozojedy**: hned po bitvě Žižka dobyl tvrz Kozojedy a nechal upálit 60 lidí (Dolejší) → aftermath, poctivá tvrdost.
6. **Detaily sesedání** (Dolejší): odepnout ostruhy, odložit plátové krytí nohou, „někdo se musel postarat o koně"; přesila panstva nejméně trojnásobná; útočili i od Hořic, kde je svah strmější → trivia.

### ⚙️ MECHANIKA – strukturální
1. **Dismount event (sesednutí)**: prameny zdůrazňují, že páni MUSELI sesednout (nemohli útočit koňmo do svahu). Engine už má dismount event (Vyšehrad „Sesednutí!"). Návrh: doplnit k `cavalry_charge_blocked` i dismount event — věrnější a mechanismus existuje.
2. *(minor)* Útok šel i od severu/Hořic (strmější svah) — hra útočí jen z jihu. Jen poznámka, případný druhý směr nasazení.

### 🎚️ MECHANIKA – balanc (PARK do AI)
1. Přesila: prameny ≥3×, hra má poměr jednotek ~1:1 (24:23). Po AI zvážit reálnější přesilu.

## Malešov (7. 6. 1424) — `malesov_1424`
**Prameny:** Toulky díl 225 „Poslední boje Jana Žižky" + Dolejší (vlastní kapitola + „Kronika velmi pěkná"). Hra = field_battle, kamenné vozy jako podmíněný event, P5 breakthrough.

**Co už sedí (hra je tu NAPŘED):** kamenné vozy jako conditional event ✓✓ (oba prameny potvrzují: „pícní vozy naplnit kamením… pustit shora… šiky úplně rozbil"); údolí + svah + „nesčekavše se" útok ✓; Hvězda+Roháč jako rádci ✓ (Dolejší: Žižka s Hvězdou místo VYBRALI, tvrz dobývali už 1421); 3 citáty vč. žitného posměšku ✓; „zemřel 4 měsíce poté" ✓ (11. 10. u Přibyslavi).

### 📜 TRIVIA / lore
1. **OPRAVA battleLore.enemySide**: „Hynek Boček z Poděbrad (zajat)" mezi nepřáteli je zmatek — Poděbradští stáli na ŽIŽKOVĚ straně (Toulky: Viktorin z Poděbrad u Malešova s Žižkou; Dolejší: Viktorin Boček vyprostil Žižku z Kostelce; Hynek Boček padl až 1426 u Nymburka). → vyhodit z enemySide, do hussiteSide přidat Viktorina.
2. **Kostelec kontext**: Malešov jen 2 DNY po probití z obklíčení v Kostelci n. L. (25. 5. zaskočen → 4.–5. 6. průlom, vyprostil ho Viktorin Boček → 7. 6. Malešov) → briefing/trivia. (Souvisí s gap-battle kandidátem Kostelec.)
3. **Jmenovaní padlí** (Kronika velmi pěkná u Dolejšího): praporečník **Turkovec padl s pražskou korouhví v ruce**, pan Hlas, mladý Vikeř, Hlaváč z Deštice, 326 pražských hospodářů; Toulky navíc: **padl i Žižkův zeť** (Ondřej/Jindřich z Dubé) → trivia (korouhevník + zeť jsou perly).
4. **Zpřesnit casualties**: kronika „na místě padlo 1 400 lidí Z OBOU STRAN"; hra má „enemy 1 200–3 000". → „~1 400 z obou stran, z toho 326 pražských hospodářů".
5. **Smír**: příměří s Prahou 14. 9. 1424 na Špitálském poli, zprostředkoval kněz Jan Rokycana; Žižkův (údajný) projev z vinného sudu (Toulky) → aftermath/trivia.
6. **+1 citát** (účastník u Dolejšího): „Ani nečekali, až se shromáždí všichni, a táhli přes to údolí, kde na ně Žižka čekal." → quotes.
- *Pozn.:* trivia „koalice se pokusila o ATENTÁT na Žižku" naše prameny nepotvrzují ani nevyvracejí — nechat, ale bez expanze. Velitel nepřátel Diviš Bořek: prameny velitele nejmenují (jen „panská jednota/pražané") — Bořek je běžný v literatuře, NECHAT (jako Erkinger).

### ⚙️ MECHANIKA – strukturální
1. **HYNEK_PODEBRADY → VIKTORIN_BOCEK** na husitské straně (jednotka VIKTORIN_BOCEK v unitTypes existuje): pramenně doložený je u Malešova Viktorin (a je to on, kdo Žižku 2 dny předtím vyprostil — hezká kontinuita). Triviální swap.

### 🎚️ MECHANIKA – balanc
— nic (velikosti koalice prameny neuvádějí).

## Ústí n. L. „Na Běhání" (16. 6. 1426) — `usti_1426`
**Prameny:** Toulky díl 229 „Jak se běhalo Na Běhání" + Dolejší (Starý letopisec, Conner, Rothe, Ebendorfer). Hra = field_battle, dvojitá hradba, no_mercy mechanika.

**Co už sedí (hodně):** dvojitá hradba ✓ (Rothe: „řetězy skrze dvojité vozy"); smírný list + „nikoho neživit" jako specialMechanic `routed_units_destroyed` ✓✓; vedro event ✓; „Běží!" ✓; klečící páni, Piccolomini/Žižka omyl, 7 hrabat+23 korouhevních pánů, ztráty 19/~4 000 v lore ✓; husitská síla „24–25 000, 500+ vozů" PŘESNĚ dle Dolejšího ✓.

### 📜 TRIVIA / lore
1. **Neděle — přesná dramaturgie** (letopisec): Češi se ve svátek nechtěli bít; Němci to vzali za strach a vyřítili se → event text (hra má jen „vedro").
2. **Převrácená řada vozů**: Němci „dorazili až k vozům a už jich jednu sešikovanou řadu převrátili. TEPRVE TEHDY Čechové spustili pokřik a stříleli" → event ve fázi 2 (dvojitá hradba to už modeluje; stačí text — vnější řada padla, vnitřní drží).
3. **Kořist + pronásledování**: 2 220 vozů, 180 děl, 4 000 stanů (Dolejší kronika); hnali je „až k míšeňským horám", mrtví „hustě jako o žních snopy", „dodnes tam leží hromady kostí"; Toulky: za Krupku a Kyšperk → trivia/debriefing.
4. **Vévodkyně Kateřina**: pomoc Ústí zorganizovala ona — a porážku neunesla, „vrhla se na zem… rvala si vlasy" (Toulky) → trivia.
5. **Jakoubek nemohl zachránit ani zajatce**: snažil se uchránit šlechtice (Valdenberka), „drábi táborští jej prostřelili" (Toulky) → trivia (temný dovětek k „nikoho neživit").
6. **Fedor z Ostrogu** 🎯: mezi husitskou šlechtou bojoval i ruský kníže Fedor z Ostrogu (+ Viktorin a Hynek Boček, Hynek z Kolštejna, Jan Smiřický, Tovačovský z Cimburka…) — payoff „chybějící osoby" z gap-listu (Dolejší) → trivia/lore commanders.
7. **Obléhání + podkopy**: Ústí (saská zástava) obléháno od Velikonoc ~3 měsíce, ženijní práce/podkopy vedl Jakoubek z Vřesovic (Dolejší) → briefing; po bitvě Korybutovič chtěl táhnout na Most, táboři+sirotci odmítli → aftermath. Volitelně +1 citát (Ebendorfer: „chytrosti kněze Prokopa Holého se dostalo Čechům krvavého vítězství" / Rothe o hácích na stahování jezdců).

### ⚙️ MECHANIKA – strukturální
— nic nutného: no_mercy i dvojitá hradba už existují; nové beaty jdou jako event texty.

### 🎚️ MECHANIKA – balanc (PARK do AI)
1. Husitská těžká jízda šlechty: dle Dolejšího tvořilo jezdectvo ~1/3 husitského vojska, vč. TĚŽKÉ jízdy panstva — hra má jen 2× JIZDA_HUSITI ze 17 jednotek. Po AI zvážit 1–2 těžké jízdní jednotky (šlechta: Boček, Smiřický, Fedor…).

## Tachov (3.–4. 8. 1427) — `tachov_1427`
**Prameny:** Toulky díl 231 „Bitva, která se nekonala" + Dolejší (velmi podrobná kapitola; svou knihu datoval výročím Tachova). Hra = pursuit_battle, eskalace paniky, startovní morálka křižáků 40.

**Co už sedí:** eskalace paniky (Plavno → dezerce → Beaufort korouhve) ✓; Kamrovcův sarkasmus v lore ✓; křižácká vlastní vozová hradba ✓ (Dolejší: rozkaz arcibiskupa Trevírského „po vzoru husitů"); Ota ze Ziegenheimu jako velitel ✓; 16 000 pěších + 1 500 jezdců husitů ✓ dle Dolejšího; sekundární cíl „Zajměte Tachov" = historické ✓.

### 📜 TRIVIA / lore
1. **Oprava event textu (kauzalita paniky)**: hra „jízda Jindřicha z Plavna se vrací bez boje – odmítli napadnout". Dolejší: 300 harcovníků bylo husity NA POCHODU ODRAŽENO a „ve zmatku se přihnalo zpět do ležení u Stříbra" → chaos → hysterický útěk k Tachovu. Byl to boj a prohra, ne odmítnutí.
2. **Vysoký vrch (3. 8.) — druhá korouhevní scéna**: Beaufort vztyčil korouhev s Kristem, prohlásil, že útok povede SÁM (knížata to vzala jako urážku kompetencí); při předávání korouhve falckraběti vypukla strkanice a **posvátná korouhev byla stržena na zem, „div ne pošlapána"** — katastrofa symboliky (Dolejší; vedle Bartoškovy verze roztržení, kterou hra už má).
3. **Pernov**: v lese u Pernova se Beaufort pokusil prchající zastavit **s křížem v ruce** — marně; skončil schovaný v lese s Fridrichem → trivia.
4. **Chorál rozhodl (4. 8.)**: knížata si přísahala neopouštět se v boji — a při zaslechnutí **„Ktož sú boží bojovníci", troubení a hluku válečných vozů** se dali na zběsilý útěk (Dolejší) → viz ⚙️1.
5. **Krvavá ulička + osud Kamrovce**: při dobývání Tachova husité prolomili severní hradbu — místo se dodnes jmenuje **Krvavá ulička**; v průlomu padlo 50 obránců **včetně rytíře Kamrovce** (autora sarkasmu!); 1 400 mužů se stáhlo do hradu a po 3 dnech kapitulovalo; hejtmanem pak Buzek ze Smolotyl → trivia + debriefing.
6. **Soupis kruciáty** (Dolejší inventář): 10 000 jízdy, 20–30 000 pěších, 8 těžkých děl, 13 obléhacích pušek, 12 komorových zadovek, 36 tarasnic, 222 ručnic, 1 000 vozů (dobově nadsazováno na „60–80 000 jezdců") → trivia + zpřesnit lore strength (hra „~25 000").
7. **Stříbro kontext**: ve Stříbře se bránil Přibík z Klenové (na pomoc mu přišel jediný — Petr Zmrzlík ze Svojšína); kořist po útěku: říšské prapory, korouhve a standarty; pronásledování „po lesích, několik tisíc pobito" → briefing/debriefing.

### ⚙️ MECHANIKA – strukturální
1. **Chorál u Tachova**: pramen výslovně dokládá, že finální rout spustilo zaslechnutí chorálu. Engine má `activate_choral` (Domažlice). Návrh: event ve fázi 3 — buď plný `activate_choral`, nebo jen `rout` s chorálním textem. ⚠️ ROZHODNOUT: plná mechanika by ředila jedinečnost Domažlic („písnička, která vyhrála bitvu") — doporučuju text-only rout, chorál mechanicky nechat Domažlicím.

### 🎚️ MECHANIKA – balanc (PARK do AI)
1. Poměr sil: pramen 30–40 000 křižáků vs. 17 500 husitů; hra 14:17 jednotek (pursuit design). Po AI.

## Nisa (18. 3. 1428) — `nisa_1428`
**Prameny:** Toulky díl 232 „Rejsy" + Dolejší (chronologie + kontext rejs). Pramenně nejtenčí bitva — lore to poctivě přiznává („reliability: Nízká"). Hra = assault_battle.

**Co už sedí:** biskup vratislavský + Půta z Častolovic ✓; obrana = narychlo sebraní sedláci ✓ (Toulky: „dvě tisíce Slezáků", hlavně sedláci); vypálení předměstí jako sekundární cíl ✓; „města se pak vzdávala bez boje" ✓.

### 📜 TRIVIA / lore
1. **Zpřesnění 2 000**: letopis říká „ke dvěm tisícům Slezáků POBITO ANEBO v řece utopeno" — hra tvrdí „2 000 utopeno". Oprava trivia + do předměstí: spálili je „I S VOZY NEPŘÁTELSKÝMI" (nový detail).
2. **Velitel scénáře**: forces.commander = „Velek z Březnice", ale na poli stojí PROKOP_HOLY a Dolejší výslovně: spanilá jízda „pod vedením Prokopa Holého". → sladit commander na Prokopa (Velek zůstane v lore commanders).
3. **Minstrberk — PRVNÍ smlouva o výpalném**: systém výpalného začal smlouvou husitských hejtmanů s radou Minstrberku (Toulky) → trivia (zrod „business modelu" rejs).
4. **Falkenberk a Břeh lehly popelem** (Toulky) → trivia (co se stalo neplatičům).
5. **Účel rejs dle Dolejšího**: nejen odveta a kořist — i získávání spojenců v lidových vrstvách a drobné šlechtě, podnícení povstání, útok na majetek církevní hierarchie → obohatit historicalSignificance/aftermath.
6. **Citát vyměnit**: lore má anglický citát („They arrived before Neisse…", zdroj „The Hussite Wars") — v českém lore divné. Nahradit letopisem: „ke dvěma tisícům Slezáků pobito aneb v řece utopeno" (Staré letopisy) + barva Půty: notorický protivník (1423 s Janem Městeckým přepadl Hradec Králové a vypálil předměstí).

### ⚙️ MECHANIKA – strukturální
— nic (assault design sedí; předměstí jako capture_position už je).

### 🎚️ MECHANIKA – balanc
— nic (počty neznámé, lore poctivě přiznává rekonstrukci).

*Pozn. (jiná událost, nepatří sem):* přepad sirotků u Chrastavy/Liberce (400+ pobito, „v Nise utopili či ve stodolách upálili") je Lužická Nisa, ne slezská Nysa — nezaměňovat; případný námět na scénář/kroniku porážek.

## Domažlice (14. 8. 1431) — `domazlice_1431`
**Prameny:** Toulky díl 235 „Písnička, která vyhrála bitvu" + Dolejší (mimořádně podrobné). Hra = pursuit_battle, `activate_choral` + eskalace paniky + `ai_stance` retreat. **Hra je tu už výborná** — chorál je hlavní mechanika.

**Co už sedí:** chorál spouští paniku ✓✓; Cesariniho ztracený klobouk ✓; útěk Všerubským průsmykem ✓; rychlý pochod ✓; Fridrich Braniborský + Cesarini ✓; Baldov v lore ✓; „bez boje" ✓.

### 📜 TRIVIA / lore
1. **Chorál na 7 km** (Dolejší, přesně): posádky Fridrichových vozů „jako první uslyšely zdáli hřmot vozových proudů husitů a jejich zpěv Ktož sú boží bojovníci, ačkoliv byli husité vzdáleni ještě asi SEDM KILOMETRŮ" — nebyli ani vidět. Čistě psychický šok ze zvuku. → event text (síla té scény: neviditelný nepřítel, jen zvuk).
2. **Cesariniho relikvie — víc než klobouk**: ukořistěny papežská bula (výzva k boji proti husitům), zlatý krucifix-pektorál, klobouk, roucho, rodinné šperky; některé chovány v Domažlicích **dvě století**; ukořistěné korouhve visely dlouho před **Týnským chrámem** v Praze → trivia (hra má jen klobouk).
3. **Cesariniho ironie**: kardinálský klobouk dostal ve 28 letech od Bonifáce IX. — a „později jej zanechal při útěku od Domažlic"; byl SOUČASNĚ předsedou basilejského koncilu, kruciátu ale pokládal za důležitější → payoff k trivia „Cesarini prosadil vyjednávání" (a k dalšímu oblouku: pozvání do Basileje 15. 10. 1431).
4. **Korouhevní roster — ironie**: každý velitel pod jinou korouhví — Fridrich pod říšskou, arcibiskup kolínský vlastní, vévoda saský pod PAPEŽSKOU, Jan Bavorský pod KRÁLOVSKOU, biskup würzburský pod **korouhví Království českého** (!); Cesariniho osobní garda = 300 kopiníků pod hrabětem z Plavna → trivia.
5. **Jediný reálný střet**: fyzicky se bojovalo jen s italskou jízdou mezi Domažlicemi a hradem Rýzmberkem; „největší vítězství" padlo bez boje → trivia/debriefing.
6. **OPRAVA kořisti (čísla)**: lore má „ukořistěno 8 000 vozů" a enemySide „9 000 vozů". Prameny (Toulky i Dolejší): ukořistěno **~2 000 vozů a ~300 děl**. „9 000" je Cesariniho PLÁN (několik tisíc vozů po husitském vzoru), ne doložený stav ani kořist. → sjednotit: měli několik tisíc, ukořistěno ~2 000 + 300 děl.
7. **Píseň o vítězství**: nejkrásnější oslava je latinská Píseň o vítězství u Domažlic od Vavřince z Březové (lore ji už cituje ✓); autorství chorálu snad Bohuslav z Čechtic — nejisté (Toulky). Volitelně +citát Vavřince: „jak pták je stíhán sokolem, jak osel prchá přede lvem".

### ⚙️ MECHANIKA – strukturální
— nic nového nutného. *(Zvážit event-text upřesnění mechanismu paniky, viz níže — je to ale jen text.)*
- **Upřesnění příčiny routu (event text)**: Fridrich (nejzkušenější velitel) se pod Baldovem uzavřel do hradby a čekal; pak se rozhodl stáhnout oddíly „poněkud vzad" a vyslat jízdní průzkum — a tento **pohyb vzad ostatní pochopili jako ústup** → panika → chaos → útěk. Tj. rout nebyl zbabělost, ale **misinterpretovaný manévr**. Skvělý beat do textu fáze „Chorál a panika" (mechanicky se nic nemění).

### 🎚️ MECHANIKA – balanc (PARK do AI)
1. Poměr: kruciáta „100 000+" (lore) vs. ~40 000 husitů; hra 12 křižáků vs. 19 husitů (pursuit design, kde křižáci prchají). Po AI zvážit vizuální přesilu / víc prchajících jednotek.

## Obléhání Plzně (1433–34) — `oblehani_plzne_1433`
**Prameny:** Toulky díl 238 „Revoluce v krizi" + Dolejší. Hra = siege_assault, 4 fáze, velbloud jako morale_boost obráncům. **battleLore CHYBÍ** (jako kdysi Žatec).

**Co už sedí:** Vilém Švihovský velitel obrany ✓; Jan Pardus z Horky vede útok ✓ (Dolejší: jeho neúspěšná expedice vedla ke krizi); velbloud → znak města ✓; „největší neúspěch husitů, Plzeň odolala rok" ✓.

### 📜 TRIVIA / lore
1. **Velbloud přesně**: Jan Čapek ze Sán ho přivezl z polského tažení (dar polského krále), přivedl **11. října 1433** rovnou před obleženou Plzeň; Plzeňané mu ho při výpadu sebrali → od té doby ve znaku; po obléhání 1434 velblouda **darovali Norimberským** (Dolejší). → obohatit velbloud event + trivia.
2. **Délka a opevnění**: obléhání **14. 7. 1433 – 9. 5. 1434** (10 měsíců); husité obklíčili město příkopy a roubenou hradbou s **devíti věžemi**, 5 stálých ležení, drátěné zátarasy + poplašný systém, 40 těžkých bombard (Dolejší+Toulky). Plzeň odolala i 1421, 1427, 1431.
3. **Proč to selhalo (klíč k celé krizi)**: hlad (neúroda, vyčerpané okolí), brutální „picování", **vězení Prokopa Holého** po Pardusově nezdaru → dobrovolně opustil tábor; a hlavně **ZRADA — Přibík z Klenové**, který útok inicioval a pak ho sabotoval (Dolejší, Toulky) → trivia + debriefing.
4. **Legát Palomar** úmyslně protahoval basilejská jednání, aby husity vnitřně rozložil (Toulky) → trivia (diplomatická válka za zdmi).
5. **Most k Lipanům**: neúspěšné obléhání rozložilo morálku a jednotu polních vojsk, dopřálo katolíkům čas se sjednotit → přímá cesta k Lipanům (Dolejší explicitně). → historicalSignificance.

### ⚙️ MECHANIKA – strukturální
1. **Vytvořit `battleLore.plzen`** (báze + en overlay + mapování v ScenarioToBattleLore) — bitva ji vůbec nemá. Materiálu dost (velbloud, 9 věží, Přibíkova zrada, Palomar).

### 🎚️ MECHANIKA – balanc (PARK do AI)
1. Obléhání je zkráceno na 14 kol „generálního útoku" — dramaturgicky OK. Po AI zvážit fázi hladu/dezerce jako reálný tlak na útočníka.

## Lipany (30. 5. 1434) — `lipany_1434`
**Prameny:** Toulky díl 240 „Lipany" + Dolejší. Hra = civil_war, klamný útěk → léčka → jízda z boku. **battleLore bohatá** (Jiří z Poděbrad 14 let, tělo Prokopa nenalezeno, mohyla).

**Co už sedí (skvěle):** klamný útěk + boční jízda ✓✓ (Dolejší: „lstí vylákáni z hradby… záloha jim vpadla do boku"); „Vzhůru, na ně, prchají již!" ✓; oba Prokopové zabiti na vozech ✓ (Bartoškův citát v lore); Čapek uprchl ✓; ztráty 200/1300, Zikmundův výrok, mohyla ✓.

### 📜 TRIVIA / lore
1. **Mechanismus léčky přesně** (Toulky): panský šik vypálil 4 děla a předstíral útěk; **Mikuláš Krchlebec** (purkrabí zvíkovský) několikrát simuloval zmatek; záložní jízda **Jan Malovec z Pacova, Mikuláš z Landštejna, Arnošt z Lestkova** vpadla do boku pronásledujícím → obohatit event „Léčka".
2. **Bedřich ze Strážnice** 🎯: táborský kněz-hejtman se pokoušel vyjednat smír a **před bitvou odjel s 300 jezdci** — připravil radikály o polovinu jízdy (Toulky). Zásadní důvod porážky, ve hře chybí. → event / trivia (viz ⚙️).
3. **Rehabilitace Čapka** (Toulky revidují): Jan Čapek ze Sán utekl do Kolína (s Ondřejem Keřským), podezírán ze zrady, ale **jednal logicky jako profesionál** — hradba byla prolomená, bitva ztracená. → zjemnit „uprchl" v lore na „profesionálně se stáhl".
4. **Počasí**: vítr, déšť a bouřka před bitvou zmátly situaci (Toulky) → atmosféra.
5. **Moravané se neúčastnili** na táborsko-sirotčí straně (Dolejší) → kontext bratrovraždy.
6. **OVĚŘIT „700–900 upáleno ve stodolách"**: Toulky 240 uvádí **~700 zajatých**, upálení ve stodolách NEzmiňují (je to palackého/kronikářská tradice). Doporučuju přeformulovat na „~700 zajato, část dle tradice upálena ve stodolách" — nešířit jako jistotu.

### ⚙️ MECHANIKA – strukturální
1. **Bedřichův odjezd s 300 jezdci**: buď úvodní event (radikálům ubyde jízda) nebo aspoň text ve fázi 1 „Patová situace". Historicky to spolurozhodlo — a vysvětluje, proč radikálové neměli čím kontrovat boční jízdě.

### 🎚️ MECHANIKA – balanc (PARK do AI)
1. Poměr: radikálové ~18 000 vs. umírnění více; hra 19 vs. 16 jednotek. Léčka je scriptovaná (ai_stance) — po AI ověřit, že klamný útěk funguje i proti hráči-radikálovi.

## Obléhání hradu Sion (1437) — `sion_1437`
**Prameny:** Toulky díly 243–245 (život/zápas/smrt Jana Roháče) + Dolejší. Hra = last_stand, survive 12 kol, chybějící studna, uherské posily. **battleLore CHYBÍ.**

**Co už sedí:** Roháč brání malý hrad ✓; **chybějící studna/nedostatek vody** ✓✓ (archeologie: hrad 1 ha, bez studny!); Ptáček váhá, „Roháč je jeho strýc" ✓ (Roháč = strýc, Ptáček = synovec — SEDÍ); Zikmund posílá Uhry, **Michal Országh** ✓; 52 popravených v Praze ✓; datum 6. 9. ✓ (jeden pramen; jiný 8. 9.).

### 📜 TRIVIA / lore
1. **Roháč hrad sám pojmenoval „Sión"** (biblicky) a nově ho zbudoval na hoře u Kutné Hory (Dolejší) → trivia (poslední vzdor si dal jméno svaté hory).
2. **Šibenice podle stavu** (Toulky, mrazivý detail): v Praze všichni oběšeni — **Roháč na nejvyšší šibenici**, kněz Prostředek na prostřední, lapkové/„loupežníci" na nejnižší. Stavovská hierarchie i na popravišti. → trivia/debriefing.
3. **Požár při útoku**: při šturmu vypukl od palných zbraní požár, **Roháč ho zkoušel hasit, když byl překvapen a zajat** (Toulky) → event „Pád Sionu".
4. **Zikmund osobně vyprovodil vojsko** z Prahy za Horskou bránu (26. 4. 1437), pak litoval popravy „příliš pozdě"; poprava byla okázalá, měla zastrašit → aftermath.
5. **Temný Roháč** (kontext, Dolejší): po dobytí Slaného 1425 nechal v masných krámech upálit zrádné radní (Žižkovy metody) — neústupný „rytíř Kristův" i tvrdý muž. → vyvážená charakterizace.
6. **ARCHEOLOGICKÁ BOMBA** ⚠️ (Toulky, revizionistické): na místě 4měsíčního obléhání jen **3–4 % válečných nálezů** (~50 hrotů z 3000), vs. 65–95 % na jiných dobytých hradech. → hypotéza, že obléhání bylo **„divadlem"**: Ptáček (příbuzný) prý pouštěl obránce pro vodu, předstíral boj bez krveprolití, možná aby strýce „zachránil" před krutějším Országhem; Bartošek o obléhání nepíše vůbec. → **DESIGN TENZE:** hra hraje Sion jako zoufalou hrdinskou poslední bitvu; pramen naznačuje spíš tichou domluvu. Doporučuju: nechat hrdinský tón hry (je to finále kampaně a emočně funguje), ale **do battleLore/trivia dát tu revizionistickou pochybnost** — poctivé source-criticism, tvůj princip.

### ⚙️ MECHANIKA – strukturální
1. **Vytvořit `battleLore.sion`** (báze + en + mapování) — chybí. Materiál: Sión-jméno, šibenice, archeologie, Országh, poprava 52.

### 🎚️ MECHANIKA – balanc
— nic (last_stand design sedí; obtížnost 4 je záměr finále).
