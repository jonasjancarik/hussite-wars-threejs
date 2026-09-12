// Historická data pro bitvy husitských válek
// Kritická redakce: historicalSources.js. Texty quotes jsou označené parafráze, ne edičně ověřené citace.

const BattleLore = {
    // Bitva u Živohoště
    'zivohost': {
        name: "Bitva u Živohoště",
        date: "4. nebo 6. listopadu 1419",
        location: "Oblast mezi Živohoští a Novým Knínem",
        hussiteSide: {
            commanders: ["Břeněk Švihovský z Rýzmburka","Václav Koranda","Chval a Kuneš z Machovic"],
            strength: "~4 300 poutníků",
            composition: "Polovojensky organizovaní poutníci, venkované, měšťané"
        },
        enemySide: {
            commanders: ["Petr Konopišťský ze Šternberka","Jan Ptáček z Pirkštejna"],
            strength: "~1 300 jezdců",
            composition: "Těžká jízda české katolické šlechty"
        },
        terrain: "Vyvýšenina poblíž přechodu přes Vltavu. Vozová hradba NEBYLA použita.",
        quotes: [
            {
                text: "Střet poutníků s královskými oddíly u Vltavy patří k počátkům husitských válek. Západočeské posily umožnily části husitů pokračovat do Prahy.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Ochrana tří skupin poutníků, poloha brodu a příchod posil v konkrétním kole jsou herní rekonstrukce. Koranda zastupuje duchovní vedení výpravy; jeho přítomnost zde nepokládáme za prokázanou.",
            "Tradiční datum je 4. listopadu 1419; zpráva o svátku sv. Linharta vede také k 6. listopadu. Přesné počty a rozdělení velitelů mezi houfy nejsou jisté."
        ],
        casualties: {"hussites":"~100+ mrtvých/zajatých","enemy":"Neznámé"},
        aftermath: "Nerozhodná bitva. Ukázala nutnost organizované obrany.",
        reliability: "Tradiční datum je 4. listopadu 1419; zpráva o svátku sv. Linharta vede také k 6. listopadu. Přesné počty a rozdělení velitelů mezi houfy nejsou jisté."
    },

    // Bitva u Nekmíře
    'nekmir': {
        name: "Bitva u Nekmíře",
        date: "prosinec 1419 / leden 1420",
        location: "Poblíž tvrze Nekmíř, 17 km SZ od Plzně",
        hussiteSide: {
            commanders: ["Jan Žižka z Trocnova"],
            strength: "~300 pěších, 7 vozů",
            composition: "Pěchota z Plzně, vozy s děly a beranidly"
        },
        enemySide: {
            commanders: ["Bohuslav ze Švamberka"],
            strength: "Přes 2 000 jízdních i pěších",
            composition: "Těžká jízda plzeňského landfrýdu"
        },
        terrain: "Okolí Nekmíře. Přesné místo a podoba vozového postavení nejsou bezpečně známy.",
        quotes: [
            {
                text: "U Nekmíře se Žižkův oddíl střetl s plzeňským landfrýdem. Tradované podání uvádí sedm vozů; jde o rané husitské využití vozů v boji.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Půlkruh vozů, jejich vlastnosti a rozmístění obou stran slouží hře. Není to dochovaný plán sestavy.",
            "Bitva se datuje do prosince 1419 nebo ledna 1420. Neoznačujeme ji za první použití vozů ve světových dějinách. Počty bojovníků jsou odhady."
        ],
        casualties: {"hussites":"Nízké","enemy":"Značné, včetně Hynka z Nekmíře"},
        aftermath: "Husitské vítězství. Zrodila se vozová taktika.",
        reliability: "Bitva se datuje do prosince 1419 nebo ledna 1420. Neoznačujeme ji za první použití vozů ve světových dějinách. Počty bojovníků jsou odhady."
    },

    // Bitva u Sudoměře
    'sudomer': {
        name: "Bitva u Sudoměře",
        date: "25. března 1420",
        location: "Mezi rybníky Markovec a Škaredý, 14 km od Strakonic",
        hussiteSide: {
            commanders: ["Břeněk Švihovský z Rýzmburka (padl)","Jan Žižka z Trocnova","Valkoun z Adlaru"],
            strength: "400 pěších, 12 vozů, 9 jezdců",
            composition: "Rolníci, měšťané, ženy, děti, kněží"
        },
        enemySide: {
            commanders: ["Bohuslav ze Švamberka","Jindřich z Hradce"],
            strength: "700-2 000 těžkých jezdců",
            composition: "Těžká jízda, johanité, zbrojnoši landfrýdu"
        },
        terrain: "Úzká hráz mezi rybníky - Markovec napuštěný, Škaredý bahnitý. KLÍČOVÝ FAKTOR - bahno uvěznilo sesedlé rytíře.",
        quotes: [
            {
                text: "Dne 25. března 1420 se ustupující husité bránili mezi rybníky Markovec a Škaredý. Terén a vozy omezovaly rozvinutí útočníků.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Mapa zdůrazňuje hráz, vodu a bahno vypuštěného rybníka. Počet figur, čas útoků a délka obrany jsou nastaveny pro hratelnost.",
            "O poměru velitelské role Žižky a Břeňka Švihovského se zprávy rozcházejí. Počet padlých nelze zaměňovat s počtem zajatců; přesný účet ztrát není znám."
        ],
        casualties: {"hussites":"Počet nejistý; padl Břeněk Švihovský","enemy":"Počet nejistý"},
        aftermath: "Husitský houf se ubránil a mohl pokračovat v cestě.",
        reliability: "O poměru velitelské role Žižky a Břeňka Švihovského se zprávy rozcházejí. Počet padlých nelze zaměňovat s počtem zajatců; přesný účet ztrát není znám."
    },

    // Bitva na Vítkově
    'vitkov': {
        name: "Bitva na Vítkově",
        date: "14. července 1420",
        location: "Vrch Vítkov, Praha 3 - Žižkov",
        hussiteSide: {
            commanders: ["Jan Žižka z Trocnova"],
            strength: "26 mužů, 2 ženy a panna v srubech; pražská pomoc s cepy",
            composition: "Cepníci a sudličníci, jen pár kuší (málo prachu), 3 ženy"
        },
        enemySide: {
            commanders: ["Zikmund Lucemburský","Fridrich IV. Bojovný","Heinrich z Isenburgu (velel útoku)","Pippo Spano"],
            strength: "~30 000 celkem; 7-8 000 v sektoru, ale do hrdla se vešlo jen ~300 jezdců",
            composition: "Mezinárodní křižácká armáda"
        },
        terrain: "Úzký hřeben se strmými svahy. Pevné sruby a zídka omezovaly přístup útočníků.",
        quotes: [
            {
                text: "Vítkov bránil 14. července 1420 Jan Žižka. Obranu tvořila pevná zídka a sruby; pomoc z Prahy zasáhla do boku útočníků.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Posádka srubu je samostatná nepohyblivá herní jednotka, nikoli vůz. Počty oddílů a čas příchodu pomoci jsou zjednodušené.",
            "Přesné ztráty a totožnost kněze vedoucího pomoc nejsou bezpečně určeny. Želivský v herní sestavě je dramatické obsazení této role, ne doložená identifikace."
        ],
        casualties: {"hussites":"Jednotky až desítky","enemy":"100-300 padlých"},
        aftermath: "Rozhodné vítězství. 30. července rozpuštění křížové výpravy.",
        reliability: "Přesné ztráty a totožnost kněze vedoucího pomoc nejsou bezpečně určeny. Želivský v herní sestavě je dramatické obsazení této role, ne doložená identifikace."
    },

    // Bitva pod Vyšehradem
    'vysehrad': {
        name: "Bitva pod Vyšehradem",
        date: "1. listopadu 1420",
        location: "Pankrácká pláň, okolí kostela sv. Pankráce",
        hussiteSide: {
            commanders: ["Hynek Krušina z Lichtenburka","Hejtmani pražských a spojeneckých oddílů"],
            strength: "15-20 000 mužů",
            composition: "Pražané, orebité, táboři, žatečtí, lounští"
        },
        enemySide: {
            commanders: ["Zikmund Lucemburský","Jindřich z Plumlova","Mikšík Divůček"],
            strength: "15-20 000 mužů",
            composition: "Uhři, Němci, Slezané, česká katolická šlechta"
        },
        terrain: "Rovinatá pláň s bočním úvozem k Podolí. Boční úvoz se stal pastí pro šlechtu.",
        quotes: [
            {
                text: "Královská posádka Vyšehradu dodržela dohodu a 1. listopadu 1420 do bitvy nezasáhla. Husitskému vojsku velel Hynek Krušina z Lichtenburka.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Mapa zachovává vztah pevnosti, Vltavy, Botiče, pankráckých pozic a podolského svahu. Rozestupy, příkopy a rozdělení útočných skupin nejsou zaměřeným plánem bitvy.",
            "Rozhovory Zikmunda s pány jsou scénáristickou zkratkou, nikoli přepisem jejich slov."
        ],
        casualties: {"hussites":"~30 mužů","enemy":"400-500 včetně 25 pánů"},
        aftermath: "Porážka královského vojska a kapitulace Vyšehradu. Neznamenala ještě úplné ovládnutí Prahy.",
        reliability: "Starý způsob počítání hodin nelze mechanicky přepsat jako 15:00. Ve scénáři používáme vypršení dohodnuté lhůty, ne zdánlivě přesný čas. Přesné počty ztrát jsou nejisté."
    },

    // Bitva u Kutné Hory
    'kutna_hora': {
        name: "Bitva u Kutné Hory",
        date: "21.–22. prosince 1421",
        location: "Kutná Hora – Kaňk – cesta ke Kolínu",
        hussiteSide: {
            commanders: ["Jan Žižka (ZCELA SLEPÝ)","Viktorin Boček z Kunštátu","Hašek z Valdštejna"],
            strength: "~12 000 mužů",
            composition: "Táborité + pražané + moravští páni"
        },
        enemySide: {
            commanders: ["Zikmund Lucemburský","Pippo Spano"],
            strength: "30-50 000 mužů",
            composition: "Uherská jízda, německé a rakouské oddíly"
        },
        terrain: "Kopcovitá krajina, strategický vrch Kaňk. Terén umožnil noční únik.",
        quotes: [
            {
                text: "Po obsazení Kutné Hory královskými oddíly se husité ocitli v obklíčení. Nad ránem 22. prosince 1421 prorazili s vozy ke Kaňku a následně pokračovali ke Kolínu.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Úniková zóna představuje pokračování cesty za Kaňk. Mapa zhušťuje více etap přesunu; požadavek zachránit pět oddílů je herní cíl.",
            "Vyprávění o dobytku hnaném proti hradbě a o pozdějším Žižkově pasování patří do tradice, ne mezi podmínky vítězství."
        ],
        casualties: {"hussites":"Pro samotný průlom neznámé","enemy":"Pro samotný průlom neznámé"},
        aftermath: "Husitské vítězství. Geniální noční průlom vozovou hradbou.",
        reliability: "Přesnou hodinu průlomu, počty ztrát ani světové prvenství palby za pohybu zde netvrdíme. Dobové zprávy nedávají plán každého vozu."
    },

    // Bitva u Německého Brodu
    'nemecky_brod': {
        name: "Bitva u Německého Brodu",
        date: "8.–10. ledna 1422",
        location: "Německý Brod a přechod Sázavy; Habry jsou předchozí střet",
        hussiteSide: {
            commanders: ["Jan Žižka","Jan Hvězda z Vícemilic (Bzdinka)"],
            strength: "Posílené síly po Kutné Hoře",
            composition: "Táborité + pražané"
        },
        enemySide: {
            commanders: ["Pippo Spano"],
            strength: "Zbytky křižáckého vojska",
            composition: "Prchající uherské a rakouské oddíly"
        },
        terrain: "Město na severním břehu Sázavy, na přístupové straně od Habrů. Ústup pokračuje přes řeku k Jihlavě.",
        quotes: [
            {
                text: "Královské vojsko po porážkách u Kutné Hory a Habrů ustupovalo k Německému Brodu. Historické jádro města leží na pravém břehu Sázavy, před přechodem ve směru ústupu.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Hraje se závěr pronásledování u města, nikoli bitva u Habrů na stejném místě. Most, městská pozice a přechod přes led zhušťují události z 8.–10. ledna 1422.",
            "Propadání ledu je zachováno jako tradovaný motiv a herní riziko, ne jako přesně spočítaný účet utonulých."
        ],
        casualties: {"hussites":"Nízké","enemy":"Tisíce mrtvých v poli + ve městě"},
        aftermath: "Porážka ustupujícího vojska, dobytí a zpustošení Brodu. Údaje o ztrátách celého tažení nelze přenášet na tuto jedinou mapu.",
        reliability: "Počty kořistních vozů i obětí se liší. Figurky představují oddíly; jejich počet není počet lidí uvedený v kronice."
    },

    // Bitva u Mostu
    'most': {
        name: "Bitva u Mostu",
        date: "5. srpna 1421",
        location: "Okolí vrchu Hněvín, Most",
        hussiteSide: {
            commanders: ["Jan Želivský (radikální kazatel)"],
            strength: "Pražský husitský svaz + Žatečtí",
            composition: "Městské hotovosti, 2 pušky, 2 praky"
        },
        enemySide: {
            commanders: ["Fridrich IV. Bojovný","Hynek Hlaváč z Dubé","Zikmund z Vartenberka"],
            strength: "Saské vojsko + mostecká hotovost + katolická šlechta",
            composition: "Profesionální míšeňská armáda"
        },
        terrain: "Okolí Mostu a Hněvína; mapa je zjednodušené taktické uspořádání, nikoli doložený plán útoku.",
        quotes: [
            {
                text: "Husitské obléhání Mostu a Hněvína skončilo 5. srpna 1421 porážkou po zásahu protivníkových posil.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Záchrana situace a dobytí hradu jsou hráčovy alternativní možnosti. Rozmístění posil a jejich příchod v jednotlivých kolech jsou rekonstrukce.",
            "Z této porážky nelze odvodit, že husité bez Žižky nebo bez vozů nemohli vyhrávat. Přesná sestava, velikost vojsk a ztráty nejsou bezpečně známy."
        ],
        casualties: {"hussites":"~500+","enemy":"Neznámé"},
        aftermath: "HUSITSKÁ PORÁŽKA. Oslabení pozice Jana Želivského.",
        reliability: "Z této porážky nelze odvodit, že husité bez Žižky nebo bez vozů nemohli vyhrávat. Přesná sestava, velikost vojsk a ztráty nejsou bezpečně známy."
    },

    // Bitva u Ústí nad Labem
    'usti': {
        name: "Bitva u Ústí nad Labem",
        date: "16. června 1426",
        location: "Vyvýšenina \"Na Běhání\", 5 km od Ústí",
        hussiteSide: {
            commanders: ["Zikmund Korybutovič (formálně)","Prokop Holý (fakticky)","Jan Roháč","Jakoubek z Vřesovic"],
            strength: "24-25 000 mužů, 500+ vozů",
            composition: "Táboři, sirotci, pražané, šlechta"
        },
        enemySide: {
            commanders: ["Boso z Vitzthumu (padl)"],
            strength: "25-30 000 mužů",
            composition: "Vojska ze Saska, Míšně, Durynska"
        },
        terrain: "Mírné návrší s planinou. Dvojitá linie vozové hradby.",
        quotes: [
            {
                text: "Dne 16. června 1426 porazila spojená husitská vojska protivníka u Ústí nad Labem, v prostoru označovaném Na Běhání.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Dvě řady vozů, přístup útočníků a blízkost města jsou herní zhuštění rekonstrukce. Nejde o změřené rozestavení historické armády.",
            "Údaj o pouhých devatenácti husitských padlých uvádíme jako kronikářské tvrzení, nikoli ověřenou bilanci."
        ],
        casualties: {"hussites":"Údajně jen 19 mužů (Starý letopisec)","enemy":"~4 000 (kroniky až 15 000)"},
        aftermath: "Drtivé vítězství. Saské vévodství zdecimováno.",
        reliability: "Počty obou vojsk i obětí se v podáních výrazně liší. Uvedené odhady nevyjadřují přesnost, kterou by bylo možné přenést do počtu figurek."
    },

    // Bitva u Tachova
    'tachov': {
        name: "Bitva u Tachova",
        date: "3.–4. srpna 1427",
        location: "Severně od Tachova",
        hussiteSide: {
            commanders: ["Prokop Holý"],
            strength: "Spojené svazy",
            composition: "Táboři, sirotci, pražané"
        },
        enemySide: {
            commanders: ["Arcibiskup Ota ze Ziegenheimu","Fridrich Hohenzollern","Kardinál Jindřich Beaufort"],
            strength: "~25 000 mužů",
            composition: "Křižácké oddíly s vozovým postavením"
        },
        terrain: "Okolí Stříbra a Tachova. Nerozhodující - křižáci uprchli.",
        quotes: [
            {
                text: "Po ústupu od Stříbra se křižácké vojsko u Tachova 3.–4. srpna 1427 rozpadlo. Následovalo obléhání: město padlo 11. srpna a hrad kapituloval 14. srpna.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Herní pronásledování končí před následným obléháním. Závěrečný text tuto další etapu popisuje odděleně.",
            "Přesné místo polního střetu a počty nejsou jisté. Číslování křížových výprav závisí na započtení neúspěšných podniků; zde používáme rok, ne pořadové číslo."
        ],
        casualties: {"hussites":"Zanedbatelné","enemy":"Stovky"},
        aftermath: "Rozpad polního vojska začátkem srpna. Město bylo dobyto 11. srpna a hrad 14. srpna 1427.",
        reliability: "Přesné místo polního střetu a počty nejsou jisté. Číslování křížových výprav závisí na započtení neúspěšných podniků; zde používáme rok, ne pořadové číslo."
    },

    // Bitva u Nisy
    'nisa': {
        name: "Bitva u Nisy (Slezsko)",
        date: "březen 1428",
        location: "Před hradbami města Nisa (Nysa/Neisse)",
        hussiteSide: {
            commanders: ["Prokop Holý","Velek z Březnice","kněz Prokůpek","Jan z Bukoviny"],
            strength: "Spojené síly",
            composition: "Táboři, sirotci, pražané, moravští kališníci"
        },
        enemySide: {
            commanders: ["Biskup Konrád","Půta z Častolovic"],
            strength: "Neznámá",
            composition: "Narychlo vyzbrojení sedláci, místní hotovost"
        },
        terrain: "Před městskými hradbami. Překvapení a rychlý manévr.",
        quotes: [
            {
                text: "Tažení roku 1428 zasáhlo slezskou Nisu. Je třeba rozlišovat boj v okolí a předměstí od dobytí opevněného města.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Mapa představuje útok na předměstí a protivníkovo polní vojsko. Obsazení celého opevněného města není historicky doloženým cílem této epizody.",
            "Podrobné rozestavení, síly a přesná datace v rámci března nejsou v použitých podkladech jednotné. Mapu považujeme za volnou rekonstrukci, nikoli potvrzený plán bojiště."
        ],
        casualties: {"hussites":"Nezaznamenány","enemy":"~2 000"},
        aftermath: "Tažení do Slezska pokračovalo. Výsledek polní srážky nelze zaměňovat s dobytím opevněné Nisy.",
        reliability: "Podrobné rozestavení, síly a přesná datace v rámci března nejsou v použitých podkladech jednotné. Mapu považujeme za volnou rekonstrukci, nikoli potvrzený plán bojiště."
    },

    // Bitva u Domažlic
    'domazlice': {
        name: "Bitva u Domažlic",
        date: "14. srpna 1431",
        location: "Mezi Domažlicemi a Kdyní, u vrchu Baldov",
        hussiteSide: {
            commanders: ["Prokop Holý"],
            strength: "40-50 000 bojovníků",
            composition: "Spojené svazy táborů, sirotků a pražanů"
        },
        enemySide: {
            commanders: ["Fridrich Hohenzollern","Kardinál Giuliano Cesarini","Zikmund ODMÍTL účast"],
            strength: "100 000+ - NEJVĚTŠÍ křížová výprava",
            composition: "Několik tisíc vozů po husitském vzoru (plán 9 000), stovky děl"
        },
        terrain: "Cesta k Domažlicím, Všerubský průsmyk. Průsmyk - úzké hrdlo pro prchající.",
        quotes: [
            {
                text: "Husité přicházeli 14. srpna 1431 na pomoc obleženým Domažlicím. Křižáckou armádu zachvátila panika a následoval útěk; část vojska se přesto střetla s husity.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Chorál ve hře zesiluje strach již nejistého vojska. Rozpad velení a chybný výklad přesunu tvoří kontext paniky; nejde o jediný zázračný spouštěč.",
            "Představa, že celou bitvu vyhrála samotná píseň a vůbec se nebojovalo, patří k legendě."
        ],
        casualties: {"hussites":"Minimální","enemy":"Stovky; ukořistěno ~2 000 vozů a ~300 děl"},
        aftermath: "Rozpad křižácké výpravy urychlil přechod k jednání. Panika nevylučuje, že části vojska kladly odpor.",
        reliability: "Přesný poměr vlivu zpráv, přesunů a zvuků nelze změřit. Početnost výpravy ani ztráty nepodáváme jako jistý součet."
    },

    // Bitva u Lipan
    'lipany': {
        name: "Bitva u Lipan",
        date: "30. května 1434",
        location: "Mezi Hřiby a Lipskou horou, 40 km V od Prahy",
        hussiteSide: {
            faction: "RADIKÁLOVÉ (poražení)",
            commanders: ["Prokop Holý (padl)","Prokop Malý (padl)","Jan Čapek ze Sán (uprchl)","Ondřej Keřský"],
            strength: "6-10 000 pěších, 700 jezdců, 480 vozů",
            composition: "Táboři + sirotci"
        },
        enemySide: {
            faction: "UMÍRNĚNÍ (vítězové)",
            commanders: ["Diviš Bořek z Miletínka","Aleš Vřešťovský z Rýzmburka","Jiří z Poděbrad (14 let!)"],
            strength: "12-13 000 pěších, 1 200-1 500 jezdců, 720+ vozů",
            composition: "Panská jednota + pražané + plzeňské kontingenty"
        },
        terrain: "Lipská hora (výhodnější pro radikály), pláň u Hřib. DVĚ ARMÁDY VE VOZOVÝCH HRADBÁCH proti sobě.",
        quotes: [
            {
                text: "Dne 30. května 1434 se střetli husitští radikálové s koalicí katolíků a umírněných kališníků. Porážka znamenala zásadní oslabení polních vojsk, ne okamžitý konec všech bojů.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Léčka a rozhodnutí opustit vozové postavení jsou převedeny do několika tahů. Vítězství radikálů je přiznaná alternativní historie.",
            "Vyprávění o upalování zajatců ve stodolách nelze bez dalšího převést na přesný dodatečný počet mrtvých."
        ],
        casualties: {"hussites":"Vysoké, součty a počty popravených zajatců sporné","enemy":"Nižší; přesný počet nejistý"},
        aftermath: "Drtivá porážka radikálů. Konec polních vojsk. Kompaktáta v Jihlavě 1436.",
        reliability: "Přesná poloha jednotlivých sestav je předmětem archeologického výzkumu. Číselné odhady ztrát a zajatců nejsou jednotným a ověřeným účtem."
    },

    // Bitva u Hořic
    'horice': {
        name: "Bitva u Hořic",
        date: "duben 1423",
        location: "Vrch Gothard (357 m), JV od Hořic na Jičínsku",
        hussiteSide: {
            commanders: ["Jan Žižka (slepý)","Diviš Bořek z Miletínka"],
            strength: "~3 000 mužů, 120 vozů",
            composition: "Orebité (východočeští husité), 10% jízdní"
        },
        enemySide: {
            commanders: ["Čeněk z Vartenberka (4x přeběhlík!)","Jindřich Berka z Dubé","Arnošt Flaška z Pardubic"],
            strength: "Neznámá",
            composition: "Jízdní sbory katolické české šlechty"
        },
        terrain: "Vrch Gothard. Vozová hradba na temeni kopce.",
        quotes: [
            {
                text: "Žižkovo vojsko se v dubnu 1423 střetlo s vojskem Čeňka z Vartenberka u Hořic; zásadní roli v rekonstrukci boje má vrch Gothard.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Scénář představuje obranu výšiny s vozy a střelci. Časování sesednutí a protiútoku i obsazení velitelských rolí slouží herní rekonstrukci.",
            "Přesný dubnový den se v literatuře liší. Podrobný plán nasazení a přesné počty nemáme; označení prvního vnitřního husitského konfliktu by bylo zavádějící."
        ],
        casualties: {"hussites":"Neznámé","enemy":"Stovky zabitých a zajatých"},
        aftermath: "Drtivé orebské vítězství. Ukázalo sílu východočeských husitů.",
        reliability: "Přesný dubnový den se v literatuře liší. Podrobný plán nasazení a přesné počty nemáme; označení prvního vnitřního husitského konfliktu by bylo zavádějící."
    },

    // Bitva u Malešova
    'malesov': {
        name: "Bitva u Malešova",
        date: "7. června 1424",
        location: "U tvrze Malešov, 6 km J od Kutné Hory, údolí potoka Bohynka",
        hussiteSide: {
            commanders: ["Jan Žižka (zcela slepý)","Jan Hvězda z Vícemilic (Bzdinka)","Jan Roháč z Dubé"],
            strength: "Východočeský husitský svaz + táboři",
            composition: "Orebité + malý oddíl táborů"
        },
        enemySide: {
            commanders: ["Svatohavelská koalice","Diviš Bořek z Miletínka"],
            strength: "Větší než Žižkova",
            composition: "Pražský svaz + plzeňský landfrýd + umírnění kališníci"
        },
        terrain: "Možná rekonstrukce svahu a údolí u Malešova s vozovým postavením; přesné bojiště není určeno.",
        quotes: [
            {
                text: "Žižka 7. června 1424 porazil koalici Pražanů a katolíků u Malešova. Odborný výklad připouští přehrazení údolí vozy a následný protiútok.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Bohynka, svah i rozmístění vojska představují jednu možnou rekonstrukci. Podmíněná panika ve hře vyjadřuje rozvrácení čela kolony, ne zásah kamennými vozy.",
            "Vozy spuštěné s kamením uvádí pozdější letopisecká tradice. Jan Biederman jejich použití hodnotí jako silně nepravděpodobné."
        ],
        casualties: {"hussites":"Nejisté","enemy":"Kronikářské odhady; nelze přesně rozdělit mezi obě strany"},
        aftermath: "Výrazné Žižkovo vítězství nad protižižkovskou koalicí. Přesnou polohu bojiště neznáme.",
        reliability: "Přesné bojiště ani velitel protivníka nejsou spolehlivě určeni. Diviš Bořek je herní obsazení; konkrétní poměr 1200 ku 200 padlým není ověřený účet."
    },

    'zatec': {
        name: "Obrana Žatce",
        date: "září – 2. října 1421",
        location: "Žatec - ostrožna nad řekou Ohří, severozápadní Čechy",
        hussiteSide: {
            commanders: ["Žatecký hejtman (jméno nedoloženo)"],
            strength: "Posádka 5 400 pěších a 400 jezdců + množství lidu z okolí",
            composition: "Městská posádka, sudličníci, cepníci, kuše i hákovnice"
        },
        enemySide: {
            commanders: ["Ludvík III. Falcký","arcibiskupové z Mohuče, Kolína a Trevíru","Erkinger ze Seinsheim (vedl útoky)"],
            strength: "~20-30 000 křižáků",
            composition: "Druhá křížová výprava - říšská knížata, jízda, obléhací děla"
        },
        terrain: "Mohutná pevnost na ostrožně obtékané ze tří stran Ohří. Útok byl možný jen z jedné strany.",
        quotes: [
            {
                text: "Žatec odolal obléhání druhé křížové výpravy v září a na počátku října 1421. Obranu zajišťovala městská obec a posádka.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Jediný útočný sektor a pevně stanovený počet kol zhušťují celé obléhání. Nejde o úplný plán městského opevnění.",
            "Erkingerovo spojení s boji o Žatec roku 1420 neprokazuje jeho konkrétní roli v roce 1421. Ve hře je zvoleným představitelem obléhatelů. Počty a jednotlivé útoky jsou rekonstruované."
        ],
        casualties: {"hussites":"Nízké - město bylo dobře předzásobené","enemy":"Značné; navíc hlad v táboře"},
        aftermath: "Druhá křížová výprava se rozpadla, aniž se střetla se Žižkou v poli.",
        reliability: "Erkingerovo spojení s boji o Žatec roku 1420 neprokazuje jeho konkrétní roli v roce 1421. Ve hře je zvoleným představitelem obléhatelů. Počty a jednotlivé útoky jsou rekonstruované."
    },

    // Obléhání Plzně
    'plzen': {
        name: "Obléhání Plzně",
        date: "14. července 1433 – 9. května 1434",
        location: "Plzeň, západní Čechy",
        hussiteSide: {
            commanders: ["Prokop Holý","Jan Pardus z Horky","Jan Čapek ze Sán"],
            strength: "Spojená polní vojska táborů a sirotků",
            composition: "Táboři, sirotci; posily z Polska (Čapek ze Sán)"
        },
        enemySide: {
            commanders: ["Vilém Švihovský z Rýzmberka","plzeňský landfrýd"],
            strength: "Městská posádka a landfrýd",
            composition: "Katoličtí Plzeňané, západočeská katolická šlechta"
        },
        terrain: "Opevněné město a obléhací práce. Počty věží a děl se v rekonstrukcích liší.",
        quotes: [
            {
                text: "Obléhání Plzně trvalo od 14. července 1433 do 9. května 1434 a město odolalo.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Hrajete zhuštěný, časově neurčený útočný úsek obléhání. Jedna partie není devět měsíců v přesném sledu a vítězství husitů je alternativní výsledek.",
            "Ukořistěný velbloud se stal městským symbolem. Neuvádíme, že jej do znaku udělil Zikmund; město symbol přijalo samo a později byl potvrzen."
        ],
        casualties: {"hussites":"Vysoké ztráty a dezerce","enemy":"Město uhájeno"},
        aftermath: "Největší neúspěch husitů. Krize a rozpad jednoty polních vojsk - přímá cesta k Lipanům.",
        reliability: "Počty děl, průběh jednotlivých výpadů a sestava útočníků vyžadují opatrnost. Prokop v herní sestavě reprezentuje širší obléhání, nikoli potvrzenou účast v konkrétním útoku."
    },

    // Obléhání hradu Sion (poslední odpor Jana Roháče)
    'sion': {
        name: "Obléhání hradu Sion",
        date: "6. září 1437",
        location: "Sion u Chlístovic, nad údolím Vrchlice",
        hussiteSide: {
            commanders: ["Jan Roháč z Dubé"],
            strength: "Malá posádka (~50-60 mužů)",
            composition: "Poslední táborsko-sirotčí odbojníci"
        },
        enemySide: {
            commanders: ["Hynce Ptáček z Pirkštejna","Michal Országh"],
            strength: "Zemská hotovost a uherské oddíly",
            composition: "Vojsko Zikmunda Lucemburského, pražští měšťané"
        },
        terrain: "Skalnaté hradní jádro nad Vrchlicí, rozsáhlejší předhradí se třemi valy; severní a jižní obléhací postavení.",
        quotes: [
            {
                text: "Hrad byl obléhán od května a dobyt 6. září 1437. Novější archeologické výzkumy dokládají palebná postavení obléhatelů a intenzivní boj.",
                source: "Autorské shrnutí · odkazy v části Historie a prameny",
                kind: "paraphrase"
            }
        ],
        trivia: [
            "Mapa zachycuje vztah skalního jádra, předhradí, trojitého valu a Vrchlice. Rozsah opevnění je zmenšen; rozmístění oddílů, příchod posil a alternativní výsledek jsou herní rekonstrukce.",
            "Starší představa pouhého předstíraného obléhání není současným archeologickým závěrem. Může být uvedena jako dějina výkladů, nikoli jako důkaz, že se nebojovalo."
        ],
        casualties: {
            hussites: "Zajetí a poprava Roháče s druhy; součty se liší",
            enemy: "Neznámé; malé ztráty nelze odvodit z podílu nálezů"
        },
        aftermath: "Sion padl 6. září 1437. Jan Roháč a jeho druhové byli 9. září popraveni v Praze.",
        reliability: "Zůstává otázka, do jaké části obléhání byly tvrdé boje soustředěny. Nepřítomnost studny sama nedokazuje nepřetržitou žízeň: plán dokládá chráněný přístup k vodě."
    },
};

// Autorská stylizace protistrany, nikoli doslovné citace kronik.
const EnemyChronicles = {
    zivohost: {
        text: 'Páni dostihli houf poutníků u Vltavy a rozehnali jej dříve, než mohl proměnit kopec v pevnost. Zemský řád byl na cestě k Novému Knínu obnoven.',
        source: 'Stylizováno podle Starých letopisů českých'
    },
    nekmir: {
        text: 'Plzeňský landfrýd sevřel Žižkovy vozy v poli a rozbil káčířský houf. Tvrz Nekmíř zůstala v rukou pravověrných.',
        source: 'Stylizováno podle Starých letopisů českých'
    },
    sudomer: {
        text: 'Královští a rožmberští zlomili uprchlíky mezi rybníky a otevřeli cestu k Písku. Vozy ani bahno tentokrát neposlušné neuchránily.',
        source: 'Stylizováno podle podání Vavřince z Březové'
    },
    vitkov: {
        text: 'Křižáci dobyli dřevěné sruby na hoře a uvolnili cestu k Praze. Obránci byli potrestáni za vzdor císaři a církvi.',
        source: 'Stylizováno jako křižácký protizápis k Vavřinci z Březové'
    },
    vysehrad: {
        text: 'Král přivedl pomoc včas, prorazil k Vyšehradu a zachránil jeho posádku. Korouhevní páni splnili slib, že půjdou i tam, kam se jiní neodváží.',
        source: 'Stylizováno podle okruhu Eberharda Windeckeho'
    },
    zatec: {
        text: 'Pevnost Slunce podlehla po opakovaných útocích a její brány se otevřely vojsku kříže. Severozápadní Čechy se znovu podřídily pravé víře.',
        source: 'Stylizováno jako letopis druhé křížové výpravy'
    },
    kutna_hora: {
        text: 'Královské vojsko uzavřelo slepého hejtmana v Kutné Hoře a jeho vozy nedokázaly prorazit. Horní město zůstalo věrné králi Zikmundovi.',
        source: 'Stylizováno jako kutnohorský královský zápis'
    },
    nemecky_brod: {
        text: 'Královský zadní voj zadržel pronásledovatele před Brodem a umožnil ústup přes Sázavu. Město se tentokrát vyhnulo zpustošení.',
        source: 'Stylizováno jako královský protizápis k pražské kronice'
    },
    most: {
        text: 'Mostečtí a míšeňští obránci vyrazili od hradu, překvapili Pražany a zahnali je od města. Kacířská výprava skončila pod Hněvínem porážkou.',
        source: 'Stylizováno podle katolického podání o Mostu'
    },
    horice: {
        text: 'Čeňkova jízda dobyla Gothard a rozptýlila orebské vozy na svahu. Východní Čechy znovu poznaly moc panského vojska.',
        source: 'Stylizováno jako zápis strany Čeňka z Vartenberka'
    },
    malesov: {
        text: 'Pražané a panská hotovost sevřeli slepého hejtmana u Malešova a jeho vozy na svahu zadrželi. Země byla uchráněna další Žižkovy války proti Praze.',
        source: 'Stylizováno jako pražský protizápis k Bartoškovi z Drahonic'
    },
    usti: {
        text: 'Saské korouhve prolomily vozovou pevnost na Na Běhání a otevřely cestu k Ústí. Města za Krušnými horami byla pomstěna.',
        source: 'Stylizováno jako saský protizápis ke Křížovnickému rukopisu'
    },
    tachov: {
        text: 'Kardinál shromáždil rozkolísané oddíly u Tachova a odrazil pronásledovatele od bavorské hranice. Říšské korouhve nebyly vydány bez boje.',
        source: 'Stylizováno jako zpráva tábora kardinála Beauforta'
    },
    nisa: {
        text: 'Slezská města zastavila spanilou jízdu před Nisou a uchránila své hradby i kostely. Vetřelci odtáhli bez kořisti a bez výpalného.',
        source: 'Stylizováno jako slezský městský zápis'
    },
    domazlice: {
        text: 'Legát utišil zmatek, zformoval výpravu u Domažlic a zastavil husitský postup. Chorál se ukázal být jen písní, ne zbraní.',
        source: 'Stylizováno jako zpráva papežského legáta Juliána Cesariniho'
    },
    plzen: {
        text: 'Plzeňská obec přečkala dlouhé obléhání a uchránila své město. Ukořistěný velbloud zůstal znamením jejího odporu.',
        source: 'Stylizováno podle plzeňské městské tradice'
    },
    lipany: {
        text: 'Panská jednota vylákala polní vojska z vozů, obrátila ústup v úder a ukončila jejich vládu. Prokop padl a země dostala cestu k míru.',
        source: 'Stylizováno podle Bartoška z Drahonic'
    },
    sion: {
        text: 'Královské vojsko po dlouhém obležení dobylo Sion útokem a zajalo Jana Roháče i jeho věrné. Poslední ozbrojený vzdor proti králi byl zlomen.',
        source: 'Autorská stylizace kronikářského podání',
        counterText: 'Novější archeologické výzkumy dokládají rozsáhlejší opevnění i střelivo. Starší výklad o pouhém předstírání boje nelze považovat za závěr dnešního poznání.',
        counterSource: 'Archeologický atlas ČR a novější výzkum Sionu'
    }
};

for (const [battleId, chronicle] of Object.entries(EnemyChronicles)) {
    if (BattleLore[battleId]) BattleLore[battleId].enemyChronicle = chronicle;
}

// Mapování scenario ID na battle lore ID
const ScenarioToBattleLore = {
    'zivohost': 'zivohost',
    'nekmir': 'nekmir',
    'sudomer': 'sudomer',
    'vitkov': 'vitkov',
    'vysehrad': 'vysehrad',
    'zatec': 'zatec',
    'kutna_hora': 'kutna_hora',
    'nemecky_brod': 'nemecky_brod',
    'most': 'most',
    'usti': 'usti',
    'tachov': 'tachov',
    'nisa': 'nisa',
    'domazlice': 'domazlice',
    'lipany': 'lipany',
    'horice': 'horice',
    'malesov': 'malesov',
    'oblehani_plzne': 'plzen',
    'sion': 'sion'
};

// Funkce pro získání lore podle ID scénáře
function getBattleLore(scenarioId) {
    // Normalizace ID - převod na lowercase a odstranění diakritiky pro porovnání
    const normalizedId = scenarioId.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let baseLore = null;
    let loreKey = null;

    // Hledání v mapování
    for (const [key, loreId] of Object.entries(ScenarioToBattleLore)) {
        const normalizedKey = key.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedId.includes(normalizedKey) || normalizedKey.includes(normalizedId)) {
            baseLore = BattleLore[loreId];
            loreKey = loreId;
            break;
        }
    }

    // Přímé hledání v BattleLore pokud nenalezeno
    if (!baseLore) {
        for (const [key, lore] of Object.entries(BattleLore)) {
            const normalizedKey = key.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (normalizedId.includes(normalizedKey) || normalizedKey.includes(normalizedId)) {
                baseLore = lore;
                loreKey = key;
                break;
            }
        }
    }

    if (!baseLore) return null;

    // Aplikuj lokalizaci pokud je dostupná
    if (typeof getLocalizedBattleLore === 'function') {
        return getLocalizedBattleLore(loreKey, baseLore);
    }

    return baseLore;
}

// Funkce pro získání náhodné trivia
function getRandomTrivia(scenarioId) {
    const lore = getBattleLore(scenarioId);
    if (lore && lore.trivia && lore.trivia.length > 0) {
        const randomIndex = Math.floor(Math.random() * lore.trivia.length);
        return lore.trivia[randomIndex];
    }
    return null;
}

// Funkce pro získání náhodného citátu
function getRandomQuote(scenarioId) {
    const lore = getBattleLore(scenarioId);
    if (lore && lore.quotes && lore.quotes.length > 0) {
        const randomIndex = Math.floor(Math.random() * lore.quotes.length);
        return lore.quotes[randomIndex];
    }
    return null;
}
