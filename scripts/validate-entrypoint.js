#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

// Klasické synchronní skripty: pořadí je součástí kontraktu, ne abecední seznam.
const scriptOrder = [
    'js/core/GameStorage.js',
    'js/i18n/i18n.js', 'js/i18n/i18nHelpers.js', 'js/i18n/encyclopediaRenderer.js',
    'js/ui/sound.js', 'js/ui/music.js', 'js/ui/WoodcutRenderer.js', 'js/core/hex.js', 'js/data/unitTypes.js',
    'js/entities/Unit.js', 'js/entities/UnitFactory.js', 'js/data/battleLore.js',
    'js/data/campaign.js', 'js/systems/CampaignProgressSystem.js', 'js/data/scenarios.js',
    'js/systems/CombatSystem.js', 'js/systems/BattleActionSystem.js', 'js/systems/SaveGameSystem.js',
    'js/systems/ScenarioEventSystem.js', 'js/systems/FogOfWarSystem.js', 'js/systems/VictoryConditionsSystem.js',
    'js/systems/TutorialSystem.js', 'js/systems/MoraleSystem.js', 'js/systems/ChronicleSystem.js',
    'js/ui/ChronicleView.js', 'js/ui/BattlePanels.js', 'js/ui/BattleTooltip.js', 'js/ui/BattleMapInput.js', 'js/ui/BattleOrders.js', 'js/ui/BattleView.js',
    'js/core/game.js', 'js/ai.js', 'js/ui/main.js'
];

function readFile(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

function exactFileExists(file) {
    let directory = root;
    const parts = file.split('/');
    for (const [index, part] of parts.entries()) {
        const entry = fs.readdirSync(directory, { withFileTypes: true }).find(item => item.name === part);
        if (!entry || entry.isSymbolicLink()) return false;
        if (index === parts.length - 1) return entry.isFile();
        if (!entry.isDirectory()) return false;
        directory = path.join(directory, part);
    }
    return false;
}

function listScripts(directory = 'js') {
    return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
        const file = `${directory}/${entry.name}`;
        return entry.isDirectory() ? listScripts(file) : file.endsWith('.js') ? [file] : [];
    });
}

// Záměrně malá kontrola vlastního statického HTML, nikoli obecný HTML/JS parser.
function tags(html) {
    const result = [];
    for (const match of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)) {
        const attributes = Object.create(null);
        for (const [, name, double, single, bare] of match[2].matchAll(/\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
            const key = name.toLowerCase();
            assert.ok(!(key in attributes), `Duplicitní atribut ${key} v <${match[1]}>`);
            attributes[key] = double ?? single ?? bare ?? '';
        }
        result.push({ name: match[1].toLowerCase(), attributes });
    }
    return result;
}

function validateEntrypoint({ html = readFile('index.html'), read = readFile, exists = exactFileExists, scripts = listScripts() } = {}) {
    const assets = new Set(), loadedScripts = [], stylesheets = [];
    function reference(value, source) {
        const url = value.trim();
        if (/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(url)) return null; // bez síťových dotazů
        let file;
        try { file = decodeURIComponent(url.split(/[?#]/)[0]); }
        catch (_) { throw new Error(`${source}: neplatná URL ${url}`); }
        assert.ok(file && !file.startsWith('/') && !/[\\\x00-\x1f]/.test(file) && !file.split('/').includes('..'),
            `${source}: cesta musí zůstat relativní uvnitř projektu: ${url}`);
        file = path.posix.normalize(file);
        assert.ok(exists(file), `${source}: chybí soubor nebo nesedí velikost písmen: ${file}`);
        assets.add(file);
        return file;
    }

    const elements = tags(html);
    for (const { name, attributes: attrs } of elements) {
        assert.notEqual(name, 'base', '<base> mění rozlišení cest; nejprve upravte validátor');
        assert.ok(!('srcset' in attrs), 'Pro srcset nejprve doplňte kontrolu všech kandidátů');
        for (const attribute of ['src', 'href', 'poster']) {
            if (attribute in attrs) reference(attrs[attribute], `index.html <${name}> ${attribute}`);
        }
        if (name === 'script') {
            assert.ok(attrs.src, 'Vstup podporuje pouze explicitní externí soubory skriptů');
            assert.ok(!('async' in attrs) && !('defer' in attrs) && !('nomodule' in attrs) &&
                [undefined, '', 'text/javascript', 'application/javascript'].includes(attrs.type),
                `Skript musí zůstat synchronní a klasický: ${attrs.src}`);
            loadedScripts.push(reference(attrs.src, 'index.html script'));
        }
        if (name === 'link' && attrs.rel?.split(/\s+/).includes('stylesheet')) stylesheets.push(reference(attrs.href, 'index.html stylesheet'));
    }
    assert.deepEqual(loadedScripts, scriptOrder, 'Chybějící, duplicitní nebo přeházený skript v index.html');
    assert.deepEqual([...scripts].sort(), [...scriptOrder].sort(), 'Runtime JS soubor není zapojený do index.html nebo smluveného pořadí');
    assert.deepEqual(stylesheets, ['style.css'], 'Chybějící nebo změněný vstupní stylesheet');

    // Dvě dynamická místa načítání: cesty bereme ze zdroje, ne z druhé kopie seznamu assetů.
    const musicSource = read('js/ui/music.js');
    const audio = [...musicSource.matchAll(/new\s+Audio\(\s*(['"])([^'"]+)\1\s*\)/g)];
    assert.equal(audio.length, 1, 'Změněný způsob načítání hudby: aktualizujte kontrolu assetů');
    reference(audio[0][2], 'js/ui/music.js');

    const localeSource = read('js/i18n/i18n.js');
    const locale = [...localeSource.matchAll(/fetch\(\s*`([^`]+)`\s*\)/g)];
    assert.equal(locale.length, 1, 'Změněný způsob načítání překladů: aktualizujte kontrolu assetů');
    const template = locale[0][1];
    assert.equal((template.match(/\$\{lang\}/g) || []).length, 1, 'Locale URL musí obsahovat jednu proměnnou lang');
    const selector = html.match(/<select\b[^>]*\bid=["']language-select["'][^>]*>([\s\S]*?)<\/select>/i);
    assert.ok(selector, 'Chybí výběr podporovaných jazyků');
    const languages = tags(selector[1]).filter(tag => tag.name === 'option').map(tag => tag.attributes.value);
    assert.ok(languages.includes('cs') && languages.includes('en'), 'Chybí podporovaný jazyk cs/en');
    for (const lang of languages) {
        assert.match(lang, /^[a-z]{2}(?:-[A-Z]{2})?$/, 'Neplatný kód jazyka');
        const url = template.replace('${lang}', lang);
        assert.ok(!url.includes('${'), 'Neznámá proměnná v locale URL');
        reference(url, 'js/i18n/i18n.js');
    }
    return { scripts: loadedScripts.length, assets: assets.size, languages: languages.length };
}

if (require.main === module) {
    const result = validateEntrypoint();
    console.log(`✓ HTML vstup: ${result.scripts} skriptů ve správném pořadí, ${result.assets} lokálních souborů, ${result.languages} jazyky`);
}
module.exports = { validateEntrypoint, exactFileExists };
