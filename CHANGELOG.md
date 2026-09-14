# 📜 Changelog

## Alpha 0.3.1 (14. září 2026)

Opravy a úpravy ovládání podle prvního veřejného playtestu.

- Útok i ukončení tahu se provedou přímo, bez potvrzovacího mezikroku; rychlý druhý vstup během animace nevydá duplicitní rozkaz.
- Nevyužité akce se při ukončení tahu automaticky převedou na obranu. Rozhraní i nápověda jasně uvádějí její účinek.
- Po skončení bitvy lze skrýt výsledek, prohlédnout poslední stav bojiště a stejný debriefing znovu otevřít.
- Opravené zůstávající dosahy při přepínání oddílů, překrytý cíl mise a spodní ovládání v mobilních prohlížečích uvnitř aplikací.
- Sudoměř uzná draze zaplacené vítězství, pokud z nepřátelské armády zůstal pouze velitel.
- Nekmíř spouští rozhodující fázi včas, vede Hynka do boje a ponechává bonusový cíl dosažitelný.
- Vyšehrad už v 7. kole hromadně nemaže prchající vojsko; pozdější pravidlo „bez milosti“ platí jen pro historickou past u Podolí.
- Rozšířené regresní testy ovládání, výsledků, scénářových událostí, mobilního rozložení a dvojjazyčných textů.

## Alpha 0.3 (12. září 2026)

Vydání pro GitHub Pages s vlastní doménou `hussitewars.com`.
Přechod na novou adresu nepřenáší staré savy ani kroniky; původní data se nemažou.

- Sjednocený dřevořez titulního menu, dialogů a kroniky; čitelnější velitelé a ovládání na dotyku.
- Síla útoku zohledňuje oslabení oddílu; opraven postup útočící AI na Vítkově.
- Revidovaný historický kontext všech 18 scénářů, s rozlišením pramenů a herní rekonstrukce.
- Nová instrumentální úprava chorálu a spolehlivější ovládání hudby.
- Menu doporučuje vstup podle rozehraných a odehraných bitev, prázdné ruční uložení nezobrazuje.
- Přepínač ukazuje cílový jazyk EN/CS. Bez uložené volby se vybírá první podporovaný jazyk v preferencích prohlížeče; jinak čeština.
- Jednotný údaj o verzi v menu i obou obrazovkách O hře; odkaz podpory přejmenován na Buy me a coffee.

## Dřevořez — testovací výtvarný směr (8. září 2026)

- Ryté lesy, stavby, vodní šrafy a papírová mapa místo sytých plošek a zářících žetonů.
- Kruhové vlastní oddíly a nepřátelské štíty, společné vektorové značky v mapě i přehledu armády.
- Výběr, přesun, útok, únik a stavy jednotek mají rozlišitelné tvary; zdraví je čitelné i po vyčerpání oddílu.
- Geometrie kreslených hran odpovídá stávajícím sousedům; souřadnice a dosahy se nemění.
- Kreslení přesunuto z `HexGrid` do `WoodcutRenderer`, bez změny bojových pravidel, scénářů a formátu savu.
- Deset nových regresí pokrývá všech 13 terénů, typy jednotek, 18 scénářů, mlhu i stabilitu kreslení.
- Výtvarná změna patří pouze do testovací větve; ostré vydání vyžaduje samostatné schválení.

## Automatické kontroly a scénářové události (6. září 2026)

- Přidán GitHub Actions workflow pro push, pull request i ruční spuštění; běží stejná kontrola projektu na Node.js 24.
- CI má jen oprávnění ke čtení, připnuté verze akcí a časový limit; neinstaluje závislosti ani nenasazuje web.
- Fáze, události a posily přesunuty z `Game` do `ScenarioEventSystem`, bez změn mechanik a formátu savu.
- Zachována veřejná rozhraní i jediný stav scénáře používaný ukládáním a lokalizací.
- Sedmnáct nových regresí prošlo před extrakcí i po ní: časování, podmínky, deduplikace, posily, save/load a mechanické účinky.
- Jednotná kontrola projektu nyní spouští 55 testů; hranice prezentace se hlídá i pro nový systém.

## Oddělení prezentace a úklid CSS (6. září 2026)

- `Game` a `CombatSystem` již přímo nepoužívají DOM ani animační smyčku. Prohlížečovou prezentaci vlastní `BattleView`, `BattlePanels` a `BattleTooltip`.
- `Game` je přibližně o tisíc řádků menší; veřejné UI metody zatím zůstávají tenkými delegáty pro kompatibilitu.
- Pravidla lze testovat s vloženým pohledem bez globálního `document` a `window`; vykreslení nepřepočítává viditelnost ani morálku.
- Osm nových regresních testů hlídá prezentační kontrakt, vstupy, log a úklid UI. Celkem 38 testů v jednotné kontrole projektu.
- Původní CSS rozděleno do sedmi částí při zachování pořadí kaskády. Odstraněno 189 deklarací přepsaných pozdějšími pravidly a devět prázdných bloků.
- Přidána kontrola struktury, pořadí importů a cest v CSS a dokumentace hranic odpovědností.
- Bez záměrných změn balancu nebo vzhledu; vybrané stavy menu a bitvy porovnány s původním CSS při šířkách 390, 753 a 1280 px.

## Stabilizace bitev (6. září 2026)

- Opravená předčasná porážka na Sionu a dvojí ztráta morálky kvůli žízni.
- Útok spotřebuje akci okamžitě; dvojklik, konec tahu a ukládání nemohou přerušit rozpracovaný souboj.
- AI čeká na celý nájezd, reakční palbu i protiútok, také při zrychlení.
- Zvýraznění cílů i provedení útoku používá společnou kontrolu viditelnosti.
- Jednotné načítání celé bitvy s validací savu před výměnou instance; save v4 a kompatibilita v1–v3.
- Pauza zastavuje čekající akce. Výměna bitvy ruší staré časovače a listenery minimapy.
- Rychlá bitva nepřebírá cíle předchozí mise; po načtení nezůstávají stará čísla poškození.
- Integrační regrese nad skutečnými třídami; původní AI testy používají skutečnou hexovou mřížku.
- Jediný příkaz pro všechny kontroly: `node scripts/check.js`.

## Připravovaná Alpha 0.2 (3. září 2026)

### Nové
- Názvy míst na všech 18 mapách, respektující fog of war a jazyk hry.
- Scénářové doktríny AI: útok jízdy, pronásledování, hledání boků, klamný ústup a držení vozové hradby.
- Kampaňová pověst, odemykání aktů a jednorázový zlom po Lipanech.
- Shrnutí čtyř aktů a kronika vítězné protistrany; Sion zachovává kronikářskou i archeologickou verzi.
- Lokalizační validátor a deterministický testovací balík herního jádra.

### Změny
- Historické přesily u Hořic, Tachova a Domažlic jsou vyjádřeny počtem žetonů a doktrínou AI, ne navýšením HP.
- Ústí dostalo dvě jednotky husitské šlechtické jízdy; Plzeň mechanický tlak hladu a dezercí.
- Dynamické panely, jednotky, tooltipy, události a kampaň se překládají bez reloadu.
- Rozhraní při šířce 753 px dovoluje sbalit boční panely bez překrývání obsahu.

### Opravy
- Úplný datový kontrakt událostí, fronta notifikací, jednotná evidence úmrtí a routu.
- Save v3 ukládá čas, pověst, AI stance a stav jednorázových mechanik.
- Nová bitva čistí starý herní log; opravené překlady tlačítka zvuku a briefingu Hořic.

## Alpha 0.1 (3. února 2026)

### ✨ Features
- 🎮 18 historických scénářů
- 🎓 Interaktivní tutorial
- 🏰 Kompletní bojový systém s morálkou
- 🗺️ Fog of War systém
- 👑 Velitelské schopnosti a aury
- 🎯 Vítězné podmínky (survive, destroy, hold position, escape...)
- 🤖 AI protivník
- 📚 Encyklopedie (jednotky, taktika, historie)
- 💾 Save/Load system
- 🎵 Hudba a zvukové efekty

### 🎨 Design
- Středověký rukopis styl
- Parchment textury
- Zlaté ornamenty
- Palatino Linotype font (konzistentní napříč celou hrou)

### ⚖️ Balance
- Všechny scénáře validní (0 chyb)
- Balance ratio: průměr 1.05
- Opravené unit types
- Implementované všechny victory conditions

### 🐛 Známé problémy
- AI občas dělá divné tahy
- Mobile UX není optimalizováno
- Některé scénáře mohou být těžké
- Save může selhat v některých prohlížečích

---

## Plánované pro Beta 0.2
- 🎮 Multiplayer/hotseat mode
- 🛠️ Scenario editor
- 🏆 Achievement system
- 🌍 Lokalizace (EN/CZ)
- 📱 Mobile optimalizace
- 🤖 Vylepšená AI

---

**Alpha = Testovací verze s bugy**
**Beta = Téměř hotová verze**
**Release = Finální verze**
