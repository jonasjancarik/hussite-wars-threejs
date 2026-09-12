# Chorál — U ohně

`ktoz-jsu-bozi-bojovnici-u-ohne.mp3` je nová instrumentální herní úprava
tradičního nápěvu **Ktož jsú boží bojovníci**. Flétna vede melodii, fagot ji
místy zdvojuje v nižší oktávě; doprovod tvoří violoncella a střídmé harfové
kvinty. Tempo 80, délka přibližně 52,5 sekundy, stereo MP3 / 44,1 kHz.
Nástup, nádechy mezi frázemi a závěrečný dozvuk jsou součástí souboru.
Nejde o zpívaný sbor ani o rekonstrukci středověkého provozování chorálu.

## Původ a licence

- Melodická linka: historický chorál, volné dílo. Noty a rytmus byly přepsány
  podle [Zpěvníku Vojtěcha Beila](https://zpevnik.beil.cz/kdoz_jsou_bozi_bojovnici.html).
  Přejímá se pouze tradiční melodie, nikoli cizí nahrávka či moderní doprovod.
  [Historický zápis v reprodukci z roku 1915](https://commons.wikimedia.org/wiki/File:Kto%C5%BE_js%C3%BA_bo%C5%BE%C3%AD_bojovn%C3%ADci.jpg).
- Nástrojové samply: [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE),
  [CC0 1.0](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE).
  Poděkování: **Versilian Studios / Sam Gossner**, **Ivy Audio / Simon Dalzell**;
  střih samplů **Elan Hickler / Soundemote**.
- Doprovod, mix, přepis not pro renderer a renderovací skript vznikly pro tuto hru;
  sdílejí její licenci MIT. Nejsou použity žádné části původního MP3 vyzvánění.

Původní soubor `ktoz-jsu-bozi-bojovnici-dobrevyzvaneni.mobi.mp3` zůstává zatím
nedotčený pro porovnání; hra jej již nenačítá. Jeho původ ani práva k nahrávce
nejsou tímto dokumentem potvrzeny a nová aranžmá jej nepotřebuje.

## Reprodukování

Hra přehrává hotové MP3. **Python, NumPy, FFmpeg ani síťové načítání samplů nejsou
potřeba pro hráče nebo pro nasazení na GitHub Pages.**

Pro vývojářský render je potřeba Python 3 s NumPy a FFmpeg s `libmp3lame`:

```sh
python3 scripts/audio/render-choral.py --samples /tmp/husitske-choral-samples --fetch
```

`--fetch` výslovně povoluje stažení 16 samplů do uvedené cache mimo repozitář.
Bez něj se pracuje pouze s již staženými soubory. Zdrojový commit a SHA-256
každého samplu jsou připnuté v `scripts/audio/choral-score.json`; poškozený či
jiný soubor render zastaví. Harfa používá jiné číslování oktáv než dechy
a violoncella, proto manifest obsahuje explicitní MIDI výšky.

```sh
python3 scripts/audio/render-choral.py --samples /tmp/husitske-choral-samples --output /tmp/choral-varianta.mp3
```

Noty, harmonie a seed jsou v `choral-score.json`; mix a frázování v
`render-choral.py`. Hotové MP3 má cíl −21 LUFS a rezervu proti přebuzení.
Přehrávač zachovává uloženou hlasitost i před prvním spuštěním, respektuje
vypnutý zvuk a při bojovém chorálu spouští celou skladbu jednou od začátku.
Menu opakuje celý kus včetně krátkého závěrečného vydechnutí, nikoli nekonečný dron.
