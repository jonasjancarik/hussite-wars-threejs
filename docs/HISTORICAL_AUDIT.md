# Historická revize map a scénářů

Revize 11.–12. září 2026. Implementace je lokální; dokument sám neznamená vydání ani nasazení.

## Jak číst hru

Každý z 18 scénářů má v briefingu, výsledcích a osobní kronice oddíl **Historie a prameny**.
Odděluje doložený rámec, herní rekonstrukci, tradici a nejistoty. Odkazy v exportované
kronice slouží k četbě; samotný export nepotřebuje připojení ani vzdálené skripty.

Jde o kritickou redakci proti dostupným studiím, archeologickým plánům a institucionálním
přehledům, nikoli úplnou kolaci rukopisů či kritických edic. Ne každá použitá publikace
je primární pramen. Kategorie zdroje je uvedena u odkazu. Neověřené údajné doslovné
citace v `BattleLore.quotes` nahradila označená autorská shrnutí. Rozhovory a povely
jsou dramatizace, „kronika protistrany“ je nadále výslovně označená herní fikce.

Figurka představuje oddíl, ne jednoho člověka; počet tahů nemá historickou délku.
Čísla oddílů se nepřepočítávala podle nejistých kronikářských údajů. Mapa zachycuje
vztahy míst a taktickou situaci, ne měřítkový plán. Závěry rozlišují výsledek partie
od historického výsledku.

## Rozhodnutí pro jednotlivé bitvy

| Scénář | Změna / vymezení |
| --- | --- |
| Živohošť | Přiznané kolísání data 4./6. listopadu; role velitelů a rozestavení nejsou certifikované. |
| Nekmíř | Prosinec 1419 / leden 1420. Rané husitské použití vozů, ne světové prvenství; půlkruh je rekonstrukce. |
| Sudoměř | Opatrnější výklad vedení a ztrát. Žádná změna terénu, sil, cílů nebo událostních mechanik. |
| Vítkov | Dva vozy nahrazeny pevnými posádkami srubů. Vlastní značka a nulový pohyb; nepatří do vozové formace. Želivský jako představitel pražské pomoci je přiznané herní obsazení. |
| Vyšehrad | Hrad při Vltavě, Botič severně, Podolí na západním boku Pankráce; přesunuté boční síly a oblasti spouštěčů. Vypršení lhůty místo zavádějícího přesného času. Dobytí hradu není ovládnutí celé Prahy. Text bonusového cíle opraven na skutečných 50 %. |
| Most | Porážka nepředstavuje důkaz, že husité bez Žižky či vozů nemohli vyhrávat. Směry a přesné sestavy nejsou předkládány jako jisté. |
| Žatec | Září – 2. října 1421; Erkingerova figurka představuje zvolenou roli, ne bezpečné určení velení roku 1421. |
| Kutná Hora | Přes Kaňk na severozápad ke Kolínu. Odražené rozmístění zachovává vzájemné vzdálenosti na odd-q síti; Kaňk leží na trase ústupu. Bez údajného světového prvenství palby za jízdy. |
| Německý Brod | Město před Sázavou při příchodu od Habrů, ústup dále k Jihlavě. Habry jsou předchozí střet, ne kopec na téže taktické mapě. Ledová mechanika zůstává s upozorněním na povahu zpráv. |
| Hořice | Duben 1423; české i anglické texty odpovídají obraně s vozy, ne bitvě bez hradby. |
| Malešov | Panika přeplněného čela kolony nahrazuje jistotu zásahu vozy s kamením. Spouštěč, časové okno i síla účinku zůstávají; přesné místo je nejisté. |
| Ústí | Odhady ztrát nelze číst jako přesné součty. Odstraněna absolutní tvrzení o „nejkrvavější“ či „poslední“ bitvě tohoto typu. |
| Tachov | Polní epizoda 3.–4. srpna oddělena od pozdějšího dobytí města a hradu. Rok místo sporného číslování výpravy. |
| Nisa | Březen 1428, volná rekonstrukce. Polní střet / předměstí není dobytí opevněného města. |
| Domažlice | Pomoc obleženému městu, ne jeho dobytí. Chorál ponechán jako herní morální účinek, nikoli jediná historická příčina útěku. |
| Plzeň | 14. července 1433 – 9. května 1434. Hraje se neurčený útočný výsek, ne doložený generální útok v říjnu. Velbloud nebyl Zikmundovou odměnou do znaku. |
| Lipany | Konec převahy radikálních polních vojsk, ne okamžitý konec všech bojů. Sporné součty popravených zajatců nejsou jistým přídavkem k padlým. |
| Sion | Jádro, předhradí, trojitý val, Vrchlice a dvě obléhací pozice. Zrušena automatická žízeň odvozená pouze z chybějící studny. Archeologický výklad nezaměňovat za jistotu předstíraného boje. Pád 6. září, poprava v Praze 9. září 1437; bez nepodloženého určení Staroměstského náměstí. |

## Použitá četba

Úplný katalog a přiřazení ke všem 18 scénářům jsou v
[historicalSources.js](../js/data/historicalSources.js); textové závěry jsou v `history.scenarios`
české i anglické lokalizace. Klíčová rozhodnutí lze dohledat zejména zde:

- Sion: [Archeologický atlas ČR – lokalita, plán a literatura](https://www.archeologickyatlas.cz/cs/lokace/chlistovice_kh_hrad_sion).
- Malešov: [Jan Biederman, VHÚ – legenda o vozech s kamením](https://www.vhu.cz/zizkovo-vitezstvi-u-malesova-a-vozy-naplnene-kamenim/).
- Vyšehrad: [Kašička–Nechvátal, Vyšehrad v době husitské](https://staletapraha.cz/pdfs/pha/1984/01/12.pdf).
- Kutná Hora: [VHÚ – výklad tažení u exponátu Halapartníci](https://www.vhu.cz/exhibit/halapartnici-cca-1421/).
- Vítkov: [Univerzita obrany – Bitva na Vítkově](https://lib.unob.cz/INFO_ARCHIV/INFO/info.unob.cz/Stranky/2013/07/20130711.html).
- Lipany: [Militká–Šámal, archeologická prospekce bojiště](https://journals.phil.muni.cz/archaeologia-historica/article/view/35158).

## Savy a ověření

Kutná Hora, Brod, Vyšehrad, Vítkov a Sion mají `mapRevision: 2`. Jejich staré rozehrané
snapshoty se odmítnou s vysvětlením **před** zrušením aktuální hry. Data se nemažou,
ale bitvu na změněné mapě je nutné začít znovu. Postup kampaně a osobní kronika
se nemigrují ani neresetují. Starší savy nezměněné Sudoměře zůstávají podporované.

`node scripts/test-historical-context.js` kontroluje 24 případů: úplnost poznámek a
odkazů CS/EN, bezpečné HTML, směry a vztahy terénu, průchodnost k cílům, sruby,
paniku u Malešova, revize savů a otisk nezměněné mechanické konfigurace Sudoměře.
Celý regresní běh: `node scripts/check.js`.

Kontrola v izolovaném Chromu otevřela briefing a mapu všech 18 scénářů při
1440 × 1000 px a navíc Vítkov, Kutnou Horu a Sion při dotykových 390 × 844 px.
Ověřeny byly zdroje před bitvou, jejich zobrazení ve výsledcích a osobní kronice,
uložení nové revize i vodorovné rozměry dialogů. Kontrola neměnila hráčovo úložiště.

Automatická průchodnost neověřuje obtížnost. V dalším ručním playtestu mají prioritu
Kutná Hora (pět uniklých oddílů včas), Brod (tlak na most), Vyšehrad (podolský bok),
Vítkov (pevné posádky) a Sion (obrana předhradí bez automatického postihu žízní).
