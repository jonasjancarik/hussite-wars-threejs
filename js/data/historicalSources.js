// Sources consulted in the 2026-09-11 audit. These are not all primary
// chronicles: the UI explicitly identifies research and secondary accounts.
const HistoricalSources = {
    reviewed: '2026-09-11',
    catalog: {
        earlyBattles: { kind: 'scholarship', title: 'VHÚ: Bitva u Sudoměře – s vozy proti železným pánům (2015)', url: 'https://www.vhu.cz/bitva-u-sudomere-s-vozy-proti-zeleznym-panum/' },
        zivohost: { kind: 'secondary', title: 'Bitva u Živohoště (4. nebo 6. 11. 1419), s přepisem zprávy Vavřince z Březové', url: 'https://www.e-stredovek.cz/post/bitva-u-zivohoste/' },
        nekmir: { kind: 'institutional', title: 'Obec Nekmíř: Historie', url: 'https://www.nekmir.cz/obec-nekmir/historie/' },
        vitkov: { kind: 'scholarship', title: 'Aleš Binar: Bitva na Vítkově, Univerzita obrany (2013)', url: 'https://lib.unob.cz/INFO_ARCHIV/INFO/info.unob.cz/Stranky/2013/07/20130711.html' },
        vysehrad: { kind: 'research', title: 'F. Kašička – B. Nechvátal: Vyšehrad v době husitské, Staletá Praha (1984), s. 121–140', url: 'https://staletapraha.cz/pdfs/pha/1984/01/12.pdf' },
        most: { kind: 'institutional', title: 'Oblastní muzeum v Děčíně: Česká listina z Děčína a Zikmund z Vartenberka', url: 'https://www.muzeumdc.cz/index.php/en/node/383' },
        zatec: { kind: 'secondary', title: 'Husitství.cz: II. křížová výprava (1421)', url: 'https://husitstvi.cz/vojenstvi/bitvy-a-tazeni/ii-krizova-vyprava-1421/' },
        kutna: { kind: 'institutional', title: 'VHÚ: Halapartníci, cca 1421 – výklad tažení u Kutné Hory', url: 'https://www.vhu.cz/exhibit/halapartnici-cca-1421/' },
        brod: { kind: 'institutional', title: 'Město Havlíčkův Brod: 770 let Havlíčkova Brodu', url: 'https://www.muhb.cz/770-let-havlickova-brodu/' },
        horice: { kind: 'institutional', title: 'Městské informační centrum Hořice: Historie města', url: 'https://infocentrum.horice.org/o-meste/historie' },
        malesov: { kind: 'scholarship', title: 'Jan Biederman: Žižkovo vítězství u Malešova a legenda o vozech naplněných kamením, VHÚ (2015)', url: 'https://www.vhu.cz/zizkovo-vitezstvi-u-malesova-a-vozy-naplnene-kamenim/' },
        usti: { kind: 'institutional', title: 'Muzeum města Ústí nad Labem: Bitva na Běhání', url: 'https://ucebnice.muzeumusti.cz/bitva-na-behani-2/' },
        tachov: { kind: 'institutional', title: 'Město Tachov: Husitství', url: 'https://www.tachov.cz/husitstvi.html' },
        nisa: { kind: 'institutional', title: 'Muzeum Powiatowe w Nysie: Świat biskupów – katalog', url: 'https://www.muzeum.nysa.pl/data/files/katalog__wiat_biskupow.pdf' },
        domazlice: { kind: 'scholarship', title: 'Aleš Binar: Bitva u Domažlic 14. srpna 1431, Univerzita obrany (2016)', url: 'https://lib.unob.cz/INFO_ARCHIV/INFO/info.unob.cz/Stranky/2016/08/20160810.html' },
        plzen: { kind: 'institutional', title: 'Západočeské muzeum: Plzeňská městská zbrojnice – obléhání 1433–1434', url: 'https://zcm.cz/en/visit/expositions/municipal-armoury-of-pilsen' },
        plzenArms: { kind: 'institutional', title: 'Encyklopedie města Plzně: Historie městského znaku', url: 'https://encyklopedie.plzen.eu/home-mup/?acc=profil_udalosti&load=23' },
        lipany: { kind: 'research', title: 'L. Militká – Z. Šámal: Archeologická prospekce bojiště u Lipan, Archaeologia historica 44/2 (2019), s. 699–713', url: 'https://journals.phil.muni.cz/archaeologia-historica/article/view/35158' },
        sionAtlas: { kind: 'research', title: 'Archeologický atlas ČR: Chlístovice – hrad Sion, plán lokality a obléhacích prací', url: 'https://www.archeologickyatlas.cz/cs/lokace/chlistovice_kh_hrad_sion' },
        sionReview: { kind: 'scholarship', title: 'VHÚ: Jan Roháč na Sióně – starší a novější archeologické výklady', url: 'https://www.vhu.cz/exhibit/janska-eva-jan-rohac-na-sione/' }
    },
    scenarios: {
        zivohost_1419: ['zivohost', 'earlyBattles'], nekmir_1419: ['earlyBattles', 'nekmir'],
        sudomere_1420: ['earlyBattles'], vitkov_1420: ['vitkov'], vysehrad_1420: ['vysehrad'],
        most_1421: ['most'], zatec_1421: ['zatec'], kutna_hora_1421: ['kutna'],
        nemecky_brod_1422: ['kutna', 'brod'], horice_1423: ['horice'], malesov_1424: ['malesov'],
        usti_1426: ['usti'], tachov_1427: ['tachov'], nisa_1428: ['nisa'], domazlice_1431: ['domazlice'],
        oblehani_plzne_1433: ['plzen', 'plzenArms'], lipany_1434: ['lipany'], sion_1437: ['sionAtlas', 'sionReview']
    }
};
