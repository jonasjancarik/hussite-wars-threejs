# Dřevořez v testovací hře

Výtvarný směr z interaktivní studie je převedený na skutečné scénáře. Studie
nebyla zkopírovaná jako nová hra: zůstávají původní mapy, pravidla, kamera,
potvrzení útoku, přímý přesun a save v4. Lokální větev je `codex/mobile-ui`,
publikační cíl pouze `husitske-valky-test`. Stabilní repozitář se nemění.

## Vizuální jazyk

- Červený kruh: vlastní strana. Modrý štít: protivník, včetně umírněných u Lipan.
- Praporec označuje velitele; jeho jméno a schopnosti zůstávají v inspektoru.
- Zelený přerušovaný hex s tečkou: přesun. Červený obrys s křížky: útok.
- Dvojitá tmavá linka: vybraný hex. Šipka: cílová úniková zóna.
- `↻` značí spotřebovaný pohyb, `×` spotřebovaný útok, `✓` obojí.
- Obrana má přerušovaný okraj žetonu, děs/útěk `!`, druhá rychlá střela `1`.
- Délka segmentované lišty pod žetonem odpovídá zdraví. Čísla zůstávají v panelu.

Terénní motivy vycházejí z typu skutečného hexu, nikoli z dekorativní mapy studie.
Kreslení je stabilní při opakovaném obnovení, bez `Math.random()`. Neprozkoumaný
terén nepředává svou barvu ani motiv; napojení cesty neodhaluje neprozkoumané sousedy.
Stíny prozkoumaných míst pokrývají také ryté detaily.

## Kontroly

`node scripts/check.js` zahrnuje `scripts/test-woodcut.js`. Ten kreslí všech 13 typů
terénu ve čtyřech velikostech, všechny typy jednotek a všech 18 scénářů; kontroluje
geometrii, mlhu, shodu SVG/Canvas značek, stavy oddílů a neměnnost herních dat.

V prohlížeči ověřit:

1. České a anglické menu, rozkazy a první bitvu.
2. Výběr oddílu, přímý přesun, náhled/uskutečnění útoku, AI a další kolo.
3. Obnovení rozehrané pozice po reloadu; souřadnice, zdraví a kolo se zachovají.
4. Telefon 320/390 px, tablet a desktop: žádný vodorovný přetok stránky,
   dostupné rozkazy, scrollovatelný detail a čitelné značky při zoomu.
5. V širším pohledu lesy, řeky, hráze, stavby, názvy míst a minimapu.

Simulovaná velikost okna nenahrazuje fyzický iPhone/iPad. Při reálném playtestu
ještě zkontrolovat čitelnost venku, plynulost tažení a pinch, iOS lišty a návrat
do rozehrané bitvy po přepnutí aplikace.
