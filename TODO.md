# TODO - Husitské Války

## ✅ Hotovo (Alpha 0.2)

### Lokalizace
- [x] Plná lokalizace CS/EN - 18 scénářů
- [x] 15 battleLore záznamů přeloženo
- [x] Všechny události, zprávy, briefingy, cíle, debriefingy
- [x] Fáze (phases) s vnořenými events
- [x] Historické poznámky a datumy
- [x] Detekce jazyka prohlížeče při prvním spuštění
- [x] Dynamická aktualizace meta tagů (title, description, OG tags)
- [x] HTML lang atribut se mění s jazykem

### Funkce
- [x] Tutorial scénář
- [x] Kampaň s 17 historickými bitvami
- [x] Quick Battle režim
- [x] Encyklopedie jednotek
- [x] Save/Load systém
- [x] AI pro křižáky
- [x] Mlha války (zapíná se podle obtížnosti)
- [x] Morální systém
- [x] Speciální schopnosti (chorál, dělostřelecký bombardement)
- [x] Zvuky (pohyb, boj, výběr)
- [x] Hudba (MP3 - "Ktož jsú boží bojovníci")

### Opravy
- [x] Quick Battle funguje (opravena undefined scenario reference)
- [x] Hudba toggle funguje správně (přepsáno z Web Audio API na HTML5 Audio)
- [x] Meta tagy a SEO optimalizace

---

## 🔧 Před releasem (Alpha 1.0)

### Mobilní prohlížeče uvnitř aplikací
- [x] **Spodní bezpečná zóna pro in-app browsery (X, LinkedIn apod.)**
  - Reprodukce: otevřít sdílený odkaz v aplikaci X na telefonu na výšku; její plovoucí lišta překryje tlačítka `Ukončit tah`, `Cíle` a `Menu`.
  - Příčina: ovládání hostitelské aplikace se kreslí nad viewportem a není zahrnuto v `env(safe-area-inset-bottom)`.
  - Návrh: na mobilu přidat pod spodní herní lištu přibližně 60–72 px bezpečného prostoru a umožnit poslední ovládací prvky vysunout nad něj; neřešit pouze detekcí konkrétní aplikace.
  - Ověřit: X a LinkedIn in-app browser, běžný Chrome/Safari, portrait i landscape; mimo webview nesmí zůstat zbytečně velká mezera.
  - Implementováno měřením `visualViewport` s obecným fallbackem pro webview; skutečný X/LinkedIn na telefonu ještě ručně ověřit.

### První veřejný playtest — 14. 9. 2026
- [x] **P1 — Po přepnutí jednotky nezůstává na mapě dosah předchozí jednotky.**
  - Reprodukce: proklikávat oddíly, které už táhly, až k oddílu s dostupnou akcí; zvýraznění polí někdy patří dříve vybrané jednotce.
  - Hotovo když: výběr, `Další oddíl`, dokončení pohybu i zrušení výběru vždy odstraní staré zvýraznění a vykreslí pouze aktuálně platný dosah.
- [x] **P1 — Cíl mise se na PC nesmí schovat pod ovládání zoomu/mapy.**
  - Ověřit zejména menší výšku okna, úzký desktop a nenulový zoom prohlížeče; widget kamery nesmí překrývat text ani interakce cíle.
- [x] **P1 — Po konci bitvy lze výsledky skrýt a prohlédnout poslední stav bojiště.**
  - Výsledkové okno má jasnou akci `Prohlédnout bojiště` a jde zavřít také klávesou Escape.
  - V režimu prohlížení zůstávají dostupné kamera, mapa a detaily vlastních i viditelných nepřátelských oddílů, ale žádný herní rozkaz.
  - Stálé tlačítko `Zobrazit výsledek` vrátí stejný debriefing bez opakovaného zápisu výsledku nebo pověsti.
- [x] **P1 — Útok a ukončení tahu jsou přímé akce bez potvrzovacího mezikroku.**
  - Dotyk, pero, kompaktní myš i desktop používají stejné pravidlo: zelené pole rovnou přesouvá a červeně zvýrazněný nepřítel rovnou přijme útok.
  - `Ukončit tah` jedná okamžitě i s nevyužitými oddíly; jejich zbývající akce se bezpečně převedou na obranu.
  - Rychlý druhý tap během animace nevydá duplicitní útok. Potvrzení zůstává pouze u destruktivních navigačních akcí, například opuštění bitvy.
- [ ] **P2 — U viditelného nepřítele ukázat při hoveru jeho možný dojezd.**
  - Respektovat terén, aktuální stav jednotky a mlhu války; hover nesmí odhalovat skryté jednotky ani informace, které hráč nemá znát.
- [ ] **P2 — Přidat do menu/pauzy akci `Zkusit znovu`.**
  - Restartuje aktuální scénář od začátku; rozehraný postup se zahodí až po jasném potvrzení.
- [x] **P1 — Ukončení tahu automaticky převede nevyužité akce na obranu.**
  - Dva nezávislí testeři se ptali, proč musí před koncem tahu ručně zapínat obranu; druhý navíc postoj objevil až pozdě během hraní.
  - Obranný postoj nyní spotřebuje zbývající pohyb i útok a do dalšího tahu snižuje příchozí poškození o 30 %. Před ukončením tahu proto nemá ruční klikání na obranu žádnou nevýhodu a je pouze povinným mikromanagementem.
  - Při `Ukončit tah` automaticky zavolat stejnou obrannou akci pro každou živou neprchající hráčovu jednotku, která ještě může jednat; jednotky, jež už vyčerpaly pohyb i útok, bonus nedostanou.
  - Ruční `Obrana` musí zůstat pro vědomé ukončení akcí konkrétní jednotky během tahu a pro výuku v tutoriálu.
  - V rozhraní přímo uvést účinek (`−30 % příchozího poškození`) a pravidlo automatizace (`Nevyužité akce se při konci tahu změní v obranu`); aktivní postoj musí být zřetelný i na žetonu.
  - Ověřit jednotky bez akce, po pohybu, po útoku, po pohybu i útoku, vícenásobnou střelbu, opevnění, prchající jednotky a save/load; upravit také tutoriál a nápovědu.
- [ ] **P1 — Ověřit obtížnost Živohoště jako první hráčovy bitvy.**
  - První veřejný tester ji nedokončil ani na pět pokusů a označil těžkého rytíře za příliš silného.
  - Před změnou čísel získat alespoň tři další průchody; zvlášť ověřit srozumitelnost cíle, načasování posil a možnosti obrany proti rytíři.
- [x] **P1 — Sudoměř nesmí skončit porážkou po faktickém zničení nepřátelské armády.**
  - Reprodukce: do konce 12. kola zůstane méně než 50 % původních husitských jednotek, ale z protivníka přežije pouze osamělý velitel; výsledek je přesto porážka za vlastní ztráty.
  - Příčina: podmínka `survive` na konci kontroluje výhradně podíl vlastních přeživších, zatímco obecné vítězství zničením vyžaduje smrt každé nepřátelské jednotky včetně velitele.
  - Návrh: přidat scénářovou alternativu pro zničení či bojovou nezpůsobilost hlavní nepřátelské síly a odlišit případný pyrrhický výsledek v debriefingu; neměnit globálně význam velitelů v ostatních scénářích.
  - Přidat regresní test pro stav „živý pouze nepřátelský velitel“ a pro běžné nesplnění podmínky přežití.
- [ ] **P2 — Ověřit, zda Nekmíř neřeší jediná triviální taktika.**
  - Tester vyhrál napoprvé pouhým rozestavením vozové hradby v počáteční pozici; prověřit, zda AI umí tuto pasivní obranu ohrozit nebo scénář hráče motivuje k rozhodnutí.
- [x] **P1 — Událost „rozhodující část bitvy/střetu“ nesmí přijít až po faktickém rozhodnutí boje.**
  - Prověřit podmínku a kolo spuštění v Nekmíři; narativní zpráva podle testera dorazila, až když už bylo „vymalováno“.
- [x] **P1 — Bonus za nepřátelského velitele v Nekmíři musí být dosažitelný.**
  - Velitelé prchají do lesa na severozápadě a tester je nedokázal včas dostihnout; ověřit směr ústupu, limit kol, pohybový terén a srozumitelnost bonusového cíle.
- [ ] **P2 — Terén musí být rozpoznatelný bez tooltipu.**
  - Testerovi připadá pláň příliš neutrální a výtvarné řešení svahu a kopce nečitelné či nelíbivé.
  - Vyzkoušet jemný žlutozelený tón pláně a přepracovat kresbu svahu/kopce v rámci současného dřevorytového stylu; zachovat dostatečný kontrast jednotek, dosahů a stavových barev.
  - Ověřit rychlým testem: nový hráč má bez nápovědy správně pojmenovat základní typy polí a nezaměnit kopec se svahem.
- [ ] **P2 — Kresba vody musí plynule navazovat přes hrany sousedních hexů.**
  - Tester upozornil na viditelné zlomy mezi dlaždicemi stejné vodní plochy.
  - Prověřit souřadnice a varianty motivu; preferovat souvislý vzor v souřadnicích mapy oříznutý tvarem hexu nebo sadu hranově kompatibilních variant před nezávislou kresbou každé dlaždice.
  - Ověřit na větších vodních plochách, u členitého pobřeží a při několika úrovních přiblížení.
- [ ] **P3 — Ověřit výtvarnou konkrétnost piktogramů jednotek.**
  - Jednomu testerovi připadají příliš abstraktní a připomínají fantasy strategii; nejde zatím o problém pravidel ani jednoznačný důvod k plošné výměně.
  - Prověřit u dalších hráčů, zda z žetonu bezpečně poznají druh vojska a velitele; případnou úpravu vést k historicky konkrétnějším siluetám, ale zachovat čitelnost v malém měřítku.

### Čištění kódu
- [ ] Odstranit debug console.log záznamy:
  - [ ] `/js/ui/main.js` - Quick Battle logy (řádky 516, 525, 532, 539, 543, 546-548)
  - [ ] `/js/core/game.js` - Army creation log (řádek 108)
  - [ ] `/js/core/game.js` - First render log (řádky 1880-1883)

### Testování
- [ ] **Scénáře** - projít všech 18 scénářů v obou jazycích:
  - [ ] Tutorial (cs/en)
  - [ ] Sudoměř 1420 (cs/en)
  - [ ] Vítkův Kámen 1420 (cs/en)
  - [ ] Záhořany 1421 (cs/en)
  - [ ] Kutná Hora 1421-22 (cs/en)
  - [ ] Habry 1422 (cs/en)
  - [ ] Německý Brod 1422 (cs/en)
  - [ ] Strachov 1423 (cs/en)
  - [ ] Ústí nad Labem 1426 (cs/en)
  - [ ] Tachov 1427 (cs/en)
  - [ ] Zwettl 1427 (cs/en)
  - [ ] Taus 1431 (cs/en)
  - [ ] Domažlice 1431 (cs/en)
  - [ ] Lipany 1434 (cs/en)
  - [ ] Úštěk 1426 (cs/en)
  - [ ] Loket 1421-22 (cs/en)
  - [ ] Vysoké Mýto 1421-22 (cs/en)
  - [ ] Praha 1420 (cs/en)

- [ ] **Funkcionality:**
  - [ ] Quick Battle - vytvoření a hra
  - [ ] Save/Load - uložení a načtení hry
  - [ ] AI - chování křižáků
  - [ ] Mlha války - zapíná/vypíná podle obtížnosti
  - [ ] Speciální schopnosti fungují
  - [ ] Victory conditions - všechny typy (survive, destroy, escape, hold, atd.)
  - [ ] Tutoriál kroky fungují správně
  - [ ] Encyklopedie se správně překládá

- [ ] **Lokalizace:**
  - [ ] Všechny UI texty přeložené (žádné chybějící klíče)
  - [ ] Žádné mixování CS/EN
  - [ ] Přepínání jazyků funguje všude (menu, hra, modály)

### Dokumentace
- [ ] **README.md:**
  - [ ] Popis hry
  - [ ] Screenshot / GIF
  - [ ] Jak spustit (local server instructions)
  - [ ] Ovládání
  - [ ] Kredity
  - [ ] License info (MIT)

- [ ] **Inline komentáře:**
  - [ ] Zkontrolovat klíčové funkce mají komentáře
  - [ ] Složité algoritmy vysvětlené

### Browser Testing
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Optimalizace (volitelné pro alpha)
- [ ] Komprimovat obrázky (PNG → optimalizované PNG/WebP)
- [ ] Minifikace JS/CSS (build script)
- [ ] Lazy loading pro velké assety

---

## 🎯 Nice-to-have (Budoucí verze)

### Další jazyky
- [ ] Němčina (DE) - relevantní pro historii
- [ ] Polština (PL) - sousední země
- [ ] Připravit strukturu pro další jazyky

### Mobile/Tablet podpora
- [ ] Touch ovládání (tap místo click)
- [ ] Responsivní layout pro menší obrazovky
- [ ] Vertikální/horizontální orientace
- [ ] Gesture navigation (pinch-to-zoom?)

### Gameplay vylepšení
- [ ] Více difficulty levelů (easy/normal/hard s různými AI)
- [ ] Statistiky po bitvě (damage dealt, units lost, atd.)
- [ ] Achievement systém
- [ ] Replay funkce
- [ ] Multiplayer (hot-seat)
- [ ] Custom scenarios editor

### Audio/Visual
- [ ] Další hudební tracky pro různé části hry
- [ ] Zvukové efekty pro jednotlivé jednotky
- [ ] Animace pohybu jednotek
- [ ] Particle effects (kouř, jiskry, krev)
- [ ] Weather effects (déšť, sníh)

### Technické
- [ ] Service Worker pro offline play
- [ ] PWA manifest (instalovatelná aplikace)
- [ ] Analytics (kolik lidí hraje, které scénáře jsou populární)
- [ ] Error reporting (Sentry nebo podobné)

### Content
- [ ] Více historických bitev (1420-1434)
- [ ] Alternativní scénáře ("what if")
- [ ] Detailed lore pro každou jednotku
- [ ] Historical articles v encyklopedii

---

## 📝 Poznámky

### Známé problémy
- (žádné aktuálně)

### Technický dluh
- Console logs v kódu (k odstranění před releasem)
- Starý Web Audio API kód odstraněn (✓)

### Release checklist
1. [ ] Projít všechny TODO položky
2. [ ] Odstranit debug kód
3. [ ] Otestovat všechny scénáře
4. [ ] Napsat README
5. [ ] Commit + tag v gitu (v1.0.0)
6. [ ] Deploy na hosting
7. [ ] Oznámení release

---

**Aktuální verze:** Alpha 0.3.1 (14.09.2026)
**Cílová verze pro release:** Alpha 1.0
**Udržováno od:** 04.02.2026
