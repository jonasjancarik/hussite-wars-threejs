# Dotykové hraní – oddělený playtest

Testovací adresa je [husitske-valky-test](https://josefslerka.github.io/husitske-valky-test/).
Původní hra zůstává na `/husitske-valky/`. Test má samostatné savy, kampaň,
kroniku, nastavení a jazyk; předchozí rozehraná hra se v něm nezobrazí.
Menu a pauza obsahují označení Testovací verze, karta prohlížeče prefix `[TEST]`.

Před vydáním do stabilní hry je potřeba fyzický playtest na iOS/iPadOS a Androidu;
simulace rozměrů v desktopovém prohlížeči neověří chování skutečného dotyku,
výkon ani systémové lišty. Publikování testu není potvrzení podpory zařízení.

## Ovládání

- Na dotyku a v okně do 1200 px: vyberte vlastní oddíl a klepněte na dostupné
  pole. Přesun i pochod hradby se provedou rovnou, bez dalšího potvrzení.
  Jen útok na nepřítele má náhled s potvrzením Zaútočit; samotný náhled ani
  jeho zavření nespotřebuje akci. Nepřítele lze prohlížet bez útoku a vyčerpaný
  vlastní oddíl bez nového rozkazu. Klepnutí na dostupné prázdné pole už není inspekce.
- Tažení posouvá mapu. Dva prsty mění přiblížení v rozsahu 60–200 %; po zdvižení
  prstů se nesmí provést klik. Zoom má také tlačítka − / +, myš používá kolečko.
  Zvětšení celé stránky přes Ctrl/kolečko není blokované.
- Rozkazy a detail otevřou kartu vybraného oddílu, Armáda přehled jednotek.
  Otevřený je nejvýše jeden kompaktní panel a nezmenšuje mapu. Zavření: × nebo
  opětovné stisknutí jeho tlačítka. Další oddíl vybírá jednotku, která může jednat.
- Mapa přepíná minimapu. Na oddíl vrací kameru k výběru, bez výběru k bojišti.
- Konec tahu v kompaktním režimu žádá potvrzení, pokud některé oddíly mohou jednat.
  Escape zavře náhled nebo kartu, pak funguje běžná pauza.
- Na velkém monitoru s myší zůstávají přímé rozkazy kliknutím a postranní sloupce.
  Dotyk se rozpoznává podle vstupu a dostupnosti hrubého ukazatele, ne user-agentu.

## Rozehraná bitva

Automatická pozice `husitskeValky_autosave` je oddělená od ruční
`husitskeValky_save`. Menu nabízí samostatné Pokračovat v rozehrané a Ručně
uložená hra. Formát zůstává v4 a starší ruční savy zůstávají podporované.
Na testovací adrese mají oba klíče navíc prefix `husitskeValky_test:`;
stejně jsou oddělená všechna další uložená data.

Checkpoint vzniká po dokončené hráčské akci včetně reakcí, při spuštění/obnovení
bitvy a po rozkazu z tlačítek (postoj, hradba, undo). Neukládá se půl souboje ani
rozehraný tah AI. Při přepnutí aplikace se pozastaví běžící čekání a náhled se
zahodí; po návratu se dokončí. Ručně zapnutá pauza zůstane pauzou. Pokud systém
prohlížeč ukončí uprostřed akce, vrátíte se k poslednímu bezpečnému checkpointu.
Náhled rozkazu, kamera a historie undo se do savu neukládají.

Automatické uložení neposílá nic na server a nesynchronizuje zařízení. Úložiště
patří konkrétnímu původu (schéma, host a port); localhost, IP adresa v síti a
GitHub Pages mají každý vlastní postup. Selhání úložiště ukazuje varování;
poslední validní pozice se nepřepisuje neplatnými daty. Dokončená bitva odstraní
jen vlastní automatickou pozici, nikoli novější pozici z jiné karty nebo ruční save.

## Lokální spuštění

Na tomto počítači:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Otevřete `http://127.0.0.1:8765/`. GitHub Pages se tím nemění.

Pro vlastní telefon/tablet ve stejné důvěryhodné Wi-Fi lze server spustit s
`--bind 0.0.0.0` a na zařízení použít `http://IP_ADRESA_POCITACE:8765/`.
Tím zpřístupníte složku projektu ostatním v dané síti; nepoužívejte veřejnou Wi-Fi,
nepřesměrovávejte port do internetu a po testu server ukončete Ctrl+C.

## Kontrolní průchod před stabilním vydáním

1. iPhone/Safari a Android/Chrome: menu, briefing, první výběr, pohyb, náhled
   útoku a protiútoku, potvrzení, zrušení, obrana, undo, konec tahu.
2. iPad/Safari a Android tablet: totéž, v obou orientacích. Podle možností také
   připojená myš/stylus; změna způsobu ovládání nesmí vydat rozkaz.
3. Pomalé tažení, rychlé tažení, dva prsty, třetí prst, zvedání po jednom,
   přerušení gesta otočením obrazovky. Nikdy mimovolný pohyb nebo útok.
4. Přepnutí aplikace během souboje/AI, zamčení a odemčení, návrat, obnovení stránky.
   Žádný dvojitý útok; při zániku stránky návrat k bezpečnému checkpointu.
5. Sbalování systémových lišt, zvětšené písmo a okraje displeje. Cíle, karta
   jednotky, potvrzení a Konec tahu musí zůstat dosažitelné.
6. Živohošť, Sudoměř (hradba/pochod), větší bitva, obtížnost s mlhou. Karta
   nesmí odhalovat jednotky za mlhou. Na skutečných zařízeních zkontrolujte plynulost.
7. Desktop: přímý klik, hover, tažení, zoom, klávesnice, save/load a návrat do menu.
8. Ve stejném prohlížeči střídejte původní a testovací adresu: uložení,
   změna nastavení/jazyka a nový postup v testu nesmí měnit původní hru.

Automatická kontrola: `node scripts/check.js`. `scripts/test-touch.js` pokrývá
přímý přesun a pochod, náhledy útoku a jejich neplatnost, souřadnice/zoom, gesta a duplicitní click,
checkpointy, chyby úložiště, životní cyklus stránky a CS/EN texty.

Offline/PWA instalace, synchronizace zařízení a úpravy balancu nejsou součástí
této změny. UI testy nad DOM double a kontrola rozměrů nenahrazují fyzická zařízení.
