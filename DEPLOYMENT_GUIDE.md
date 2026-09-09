# Nasazení na GitHub Pages

Projekt používá veřejný repozitář
[josefslerka/husitske-valky](https://github.com/josefslerka/husitske-valky).
Cílová adresa hry je
[Husitské války](https://josefslerka.github.io/husitske-valky/).

## Nastavení hostingu

V repozitáři otevřete **Settings → Pages**:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**

Hra nevyžaduje build, databázi ani serverovou aplikaci. Soubor `.nojekyll` v kořeni
vypíná zpracování Jekyllem; HTML, JavaScript, CSS, překlady a hudba se publikují jako
statické soubory. Relativní cesty fungují i pod prefixem `/husitske-valky/`.

Repozitář, jeho historie a web jsou veřejné. Do commitu nepatří přístupové údaje,
osobní poznámky testerů ani knihy/PDF ze složky `zdroje/`. Gitignore není ochranou
již commitnutých souborů. Ani soukromé repo samo o sobě neznamená neveřejný Pages web.

## Oddělená testovací verze

Mobilní UI se vyvíjí v lokální větvi `codex/mobile-ui`. Stabilní `main` a Pages
repozitáře `husitske-valky` zůstávají nedotčené. Testovací kopie patří do veřejného
repozitáře [husitske-valky-test](https://github.com/josefslerka/husitske-valky-test),
jeho Pages používají vlastní `main` / `/(root)`:
[testovací hra](https://josefslerka.github.io/husitske-valky-test/).

Remote `origin` nadále znamená **stabilní** repozitář; remote `test` znamená
`https://github.com/josefslerka/husitske-valky-test.git`. Testovací repo je jen
publikační kopie se společnou historií, ne další nezávislý vývoj.
Aktualizace testovací verze z větve `codex/mobile-ui`:

```bash
git branch --show-current
git remote get-url test
node scripts/check.js
git diff --check
git status
# Po commitu zkontrolovaných změn:
git push test HEAD:main
```

Nikdy pro tento test nepoužívejte `git push origin main` ani nepřepínejte zdroj
Pages stabilního repozitáře. Publikování je veřejné, bez hesla. CI a Pages build
ověřujte v **testovacím** repozitáři; původní web tím nedostává nový obsah.

Obě projektové adresy mají stejný origin. `GameStorage` proto pro přesnou cestu
`/husitske-valky-test/` (také `index.html`) přidává všem klíčům prefix
`husitskeValky_test:`. Savy, autosavy, kampaň, kronika, nastavení i jazyk se nikdy
nepřebírají ze stabilních klíčů. Menu, pauza a titulek karty označují testovací
verzi. Na stabilní adrese zůstanou původní klíče i po budoucím merge beze změny.
Při přejmenování testovacího repozitáře nebo změně jeho URL je nutné upravit
rozpoznání v `js/core/GameStorage.js` a jeho testy **před** publikováním.
Jde o ochranu před nechtěným smícháním dat, nikoli bezpečnostní hranici mezi
nedůvěryhodnými weby. Vymazání všech dat domény v prohlížeči odstraní obě verze.

Po playtestu se mobilní větev může sloučit do stabilní `main`, ale až po samostatném
schválení produkčního vydání. Testovací postup se do produkce automaticky nemigruje.

## Další stabilní vydání

V kořeni projektu:

```bash
node scripts/check.js
git status
```

Po úspěšných kontrolách commitněte jen zamýšlené soubory a odešlete je:

```bash
git push origin main
```

Pokud se mění JS, CSS nebo locale, aktualizujte odpovídající `?v=` podle
[pravidel údržby](docs/CODE_STRUCTURE.md). Po pushi zkontrolujte v záložce
**Actions** běh **CI** a samostatný běh **pages build and deployment**.
Nahraná verze nemusí být dostupná okamžitě; konečnou adresu a stav ukazuje také
**Settings → Pages**.

Současné CI provádí kontroly, ale **neblokuje** publikování z větve. Proto musí
kontroly projít už před pushem. Nasazení podmíněné zeleným CI by vyžadovalo změnu
na vlastní publikační workflow.

## Kontrola veřejné verze

- Otevřete HTTPS adresu hry, nikoli lokální `file://` soubor.
- Zkuste české i anglické menu, první briefing a pohyb jednotky.
- Ověřte postranní panely, konec tahu, uložení a načtení.
- Po dokončení bitvy ověřte výsledek a kroniku.
- Pokud chybí překlady nebo assety, ověřte jejich HTTP odpověď a přesnou velikost
  písmen v cestě. Při staré verzi obnovte stránku a zkontrolujte cache verze.

Savy a kroniky z localhostu se na novou adresu automaticky nepřenesou. Jsou uložené
v prohlížeči pro konkrétní původ webu; hra je neposílá na server.
Podklad pro testery je v [docs/ACT_I_PLAYTEST.md](docs/ACT_I_PLAYTEST.md).

## Lokální hraní

```bash
python3 -m http.server 8000
```

Poté otevřete [localhost:8000](http://localhost:8000). Stejný HTTP server je potřeba
i po rozbalení ZIPu; samotné otevření `index.html` může zablokovat načítání překladů.

Nastavení vychází z [dokumentace GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
