#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLocalizedHarness } = require('./helpers/localized-harness');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const plain = value => JSON.parse(JSON.stringify(value));
const legacy = () => ({
    scenarioId: 'lipany_1434', result: 'defeat', playerLosses: 2, playerTotal: 10,
    enemyLosses: 3, enemyTotal: 12, fled: 1, turns: 9, blind: false, ts: 100
});

for (const language of ['cs', 'en']) {
    for (const [remaining, variant] of [[3, 'allPilgrims'], [1, 'somePilgrims'], [0, 'noPilgrims']]) {
        test(`${language}: Kronika uchová Živohošť ${variant} po další partii i změně jazyka`, async () => {
            const h = await createLocalizedHarness(language), game = h.newGame('zivohost_1419');
            game.units.filter(u => u.type === 'POUTNICI').forEach((u, i) => { u.health = i < remaining ? 1 : 0; });
            const expected = game.scenarioEventSystem.getDebriefing(true);
            game.showVictory('hussites'); game.showVictory('hussites');
            const [entry] = h.ChronicleSystem.getEntries();
            assert.equal(h.ChronicleSystem.getEntries().length, 1, 'zápis nesmí vzniknout dvakrát');
            assert.equal(entry.narrative.victoryVariant, variant);
            game.destroy(); h.newGame('sudomere_1420');
            assert.equal(h.ChronicleSystem.getPersonalEpilogue(entry), expected);
            const stored = h.storage.get(h.ChronicleSystem.STORAGE_KEY);
            await h.i18n.setLanguage(language === 'cs' ? 'en' : 'cs');
            assert.equal(h.ChronicleSystem.getPersonalEpilogue(h.ChronicleSystem.getEntries()[0]),
                h.i18n.t(`scenarios.zivohost_1419.debriefing.victoryVariants.${variant}`));
            assert.equal(h.storage.get(h.ChronicleSystem.STORAGE_KEY), stored, 'změna jazyka nesmí přepsat historii');
        });
    }
    for (const state of ['alive', 'fallen', 'escaped']) {
        test(`${language}: oba výsledky Lipan uchovají Prokopa ${state}`, async () => {
            const h = await createLocalizedHarness(language);
            for (const winner of ['hussites', 'crusaders']) {
                const game = h.newGame('lipany_1434');
                const prokop = game.units.find(u => u.type === 'PROKOP_HOLY');
                prokop.health = state === 'alive' ? 1 : 0; prokop.escaped = state === 'escaped';
                const expected = game.scenarioEventSystem.getDebriefing(winner === 'hussites');
                game.showVictory(winner);
                const entry = h.ChronicleSystem.getEntries().at(-1);
                assert.equal(entry.narrative.unitState, state);
                assert.equal(h.ChronicleSystem.getPersonalEpilogue(entry), expected);
                game.destroy();
            }
        });
    }
    test(`${language}: samostatný export obsahuje všechny hlasy, bez serveru a skriptů`, async () => {
        const h = await createLocalizedHarness(language), game = h.newGame('lipany_1434');
        game.showVictory('crusaders');
        h.ChronicleSystem.recordActSummary(4);
        const entries = h.ChronicleSystem.getEntries(), stored = h.storage.get(h.ChronicleSystem.STORAGE_KEY);
        const html = h.ChronicleView.exportDocument(entries);
        assert.ok(html.startsWith('<!doctype html>'));
        assert.ok(html.includes(`<html lang="${language}">`));
        assert.ok(html.includes('<meta charset="utf-8">'));
        assert.ok(html.includes('Content-Security-Policy'));
        assert.ok(html.includes(h.ChronicleView.escape(h.ChronicleSystem.getPersonalEpilogue(entries[0]))));
        assert.ok(html.includes(h.ChronicleView.escape(h.ChronicleSystem.generateText(entries[0]))));
        assert.ok(html.includes(h.i18n.t('chronicle.actSummaries.4')));
        assert.match(html, /<details[^>]+ open>/);
        assert.match(html, /@media print/);
        assert.doesNotMatch(html, /<script\b|<link\b|<img\b|\bsrc=|http:\/\/|file:\/\//i);
        const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
        assert.ok(links.length > 0, 'export obsahuje pramenné odkazy, ne vzdálené závislosti');
        for (const url of links) assert.match(url, /^https:\/\//);
        assert.equal(h.storage.get(h.ChronicleSystem.STORAGE_KEY), stored);
    });
}

test('všech 18 scénářů má čitelný archiv vítězství i porážky v CS/EN', async () => {
    const h = await createLocalizedHarness();
    for (const lang of ['cs', 'en']) {
        await h.i18n.setLanguage(lang);
        for (const scenario of h.ScenarioManager.getScenarioList()) {
            for (const winner of ['hussites', 'crusaders']) {
                const game = h.newGame(scenario.id);
                const expected = game.scenarioEventSystem.getDebriefing(winner === 'hussites');
                game.showVictory(winner);
                const entry = h.ChronicleSystem.getEntries().at(-1);
                assert.equal(entry.scenarioId, scenario.id);
                assert.equal(h.ChronicleSystem.getPersonalEpilogue(entry), expected);
                const html = h.ChronicleView.renderEntries([entry]);
                assert.doesNotMatch(html, /undefined|\[object Object\]|\{\w+\}/);
                assert.equal(h.ChronicleSystem.normalizeEntry(entry) !== null, true);
                game.destroy();
            }
        }
    }
});

test('save/load před koncem bitvy zachová otisk; načtený konec nevytvoří druhý zápis', async () => {
    const h = await createLocalizedHarness(), game = h.newGame('lipany_1434');
    const prokop = game.units.find(u => u.type === 'PROKOP_HOLY');
    prokop.health = 0; prokop.escaped = true;
    assert.equal(game.saveGame(), true);
    const restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game);
    restored.showVictory('hussites');
    assert.equal(h.ChronicleSystem.getEntries()[0].narrative.unitState, 'escaped');
    // Starší savy uměly obsahovat již ukončenou bitvu; její příznak zachováme.
    const finished = JSON.parse(h.storage.get(h.SaveGameSystem.STORAGE_KEY));
    finished.gameState = 'victory'; finished.chronicleRecorded = true;
    h.SaveGameSystem.write(finished);
    const ended = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), restored);
    ended.showVictory('hussites');
    assert.equal(h.ChronicleSystem.getEntries().length, 1);
});

test('chybějící Prokop zůstane neznámý i v uložené Kronice', async () => {
    const h = await createLocalizedHarness(), game = h.newGame('lipany_1434');
    game.units = game.units.filter(u => u.type !== 'PROKOP_HOLY'); game.showVictory('hussites');
    const entry = h.ChronicleSystem.getEntries()[0];
    assert.equal(entry.narrative.unitState, null);
    assert.equal(h.ChronicleSystem.getPersonalEpilogue(entry), game.currentScenario.debriefing.victory);
});

test('nové zápisy rozlišují vlastní útěk a zničení; starým se čísla nedomýšlejí', async () => {
    const h = await createLocalizedHarness(), game = h.newGame('lipany_1434');
    game.lossesByFaction.hussites = 2; game.fledByFaction.hussites = 3;
    game.lossesByFaction.crusaders = 4; game.fledByFaction.crusaders = 5;
    game.showVictory('hussites');
    const entry = h.ChronicleSystem.getEntries()[0];
    assert.equal(entry.playerLosses, 5); assert.equal(entry.playerFled, 3);
    assert.match(h.ChronicleSystem.truthText(entry), /zničeno: 2, uprchlo: 3/);
    assert.match(h.ChronicleSystem.truthText(entry), /zničeno: 4, uprchlo: 5/);
    assert.match(h.ChronicleSystem.truthText(legacy()), /starší zápis je nerozlišuje/);
});

test('starý zápis je čitelný a výslovně přizná chybějící závěr', async () => {
    const h = await createLocalizedHarness(), old = legacy();
    h.storage.set(h.ChronicleSystem.STORAGE_KEY, JSON.stringify([old]));
    const [entry] = h.ChronicleSystem.getEntries();
    assert.equal(h.ChronicleSystem.getPersonalEpilogue(entry), h.i18n.t('chronicle.legacyEntry'));
    assert.equal(entry.narrative, undefined);
    assert.equal(h.ChronicleSystem.generateText(entry), h.ChronicleSystem.generateText(old));
    assert.ok(h.ChronicleView.renderEntries([entry]).includes(h.i18n.t('chronicle.legacyEntry')));
});

test('poškozené JSON, cizí typ a jednotlivé vadné řádky neshodí Kroniku ani nezmění úložiště', async () => {
    const h = await createLocalizedHarness(), key = h.ChronicleSystem.STORAGE_KEY;
    for (const raw of ['{', '{}', 'null', 'true', '42', '"text"']) {
        h.storage.set(key, raw); assert.equal(h.ChronicleSystem.getEntries().length, 0);
        assert.equal(h.storage.get(key), raw);
    }
    const bad = [null, [], 'text', { ...legacy(), scenarioId: '__proto__' }, { ...legacy(), result: '<script>' },
        { ...legacy(), turns: -1 }, { ...legacy(), enemyLosses: '3' }, { ...legacy(), playerLosses: 11 },
        { ...legacy(), fled: 10 }, { type: 'actSummary', actId: 9 }];
    const raw = JSON.stringify([...bad, legacy(), { type: 'actSummary', actId: 1 }]);
    h.storage.set(key, raw); assert.equal(h.ChronicleSystem.getEntries().length, 2);
    assert.equal(h.storage.get(key), raw);
    assert.doesNotThrow(() => h.ChronicleView.renderEntries(h.ChronicleSystem.getEntries()));
});

test('neznámá verze či vadný otisk zachová statistiky, ale nevymyslí osud', async () => {
    const h = await createLocalizedHarness();
    for (const narrative of [{ version: 9 }, { version: 1, victoryVariant: '__proto__', unitState: 'fallen' }, { version: 1 }]) {
        const entry = h.ChronicleSystem.normalizeEntry({ ...legacy(), narrative });
        assert.equal(entry.playerLosses, 2); assert.equal(entry.narrative, undefined);
        assert.equal(h.ChronicleSystem.getPersonalEpilogue(entry), h.i18n.t('chronicle.legacyEntry'));
    }
});

test('nová partie nemaže neznámá pole starých řádků ani nepřepíše nečitelný archiv', async () => {
    const h = await createLocalizedHarness(), key = h.ChronicleSystem.STORAGE_KEY;
    const future = { ...legacy(), narrative: { version: 9, anotherFate: 'unknown' }, futureField: true };
    h.storage.set(key, JSON.stringify([future, null]));
    assert.equal(h.ChronicleSystem.record(legacy()), true);
    h.ChronicleSystem.recordActSummary(1);
    assert.deepEqual(JSON.parse(h.storage.get(key)).slice(0, 2), [future, null]);
    assert.equal(h.ChronicleSystem.getEntries().length, 3);
    h.context.console = { ...console, warn() {} };
    for (const raw of ['{', '{}', 'null']) {
        h.storage.set(key, raw);
        assert.equal(h.ChronicleSystem.record(legacy()), false);
        h.ChronicleSystem.recordActSummary(1);
        assert.equal(h.storage.get(key), raw);
    }
});

test('odmítnutý zápis úložiště nezablokuje konec bitvy ani nepředstírá uložení', async () => {
    const h = await createLocalizedHarness(), game = h.newGame('lipany_1434');
    h.context.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    h.context.console = { ...console, warn() {} };
    assert.doesNotThrow(() => game.showVictory('hussites'));
    assert.equal(game.gameState, 'victory'); assert.equal(game.chronicleRecorded, false);
    assert.equal(h.ChronicleSystem.getEntries().length, 0);
});

test('Kronika řadí podle kampaně, pak času pokusu, a souhrn nepočítá akty jako bitvy', async () => {
    const h = await createLocalizedHarness();
    const entries = [legacy(), { type: 'actSummary', actId: 1, ts: 300 },
        { ...legacy(), scenarioId: 'zivohost_1419', result: 'victory', ts: 200 },
        { ...legacy(), scenarioId: 'zivohost_1419', ts: 50 }];
    const before = JSON.stringify(entries), sorted = plain(h.ChronicleSystem.sortEntries(entries));
    assert.deepEqual(sorted.map(e => e.ts), [50, 200, 300, 100]);
    assert.equal(JSON.stringify(entries), before);
    assert.equal(h.ChronicleSystem.getSummary(entries), 'Zápisy bitev: 3 · Vítězství: 1 · Porážky: 2');
});

test('všechny texty se escapují v modalu i exportu; uložená pole nemohou vložit HTML', async () => {
    const h = await createLocalizedHarness(), attack = '</p><script>alert("x")</script><img src=x onerror="alert(1)">&';
    const entry = { ...legacy(), narrative: { version: 1, victoryVariant: null, unitState: 'alive' }, note: attack };
    h.i18n.translations.cs.scenarios.lipany_1434.name = attack;
    h.i18n.translations.cs.chronicle.fictionNotice = attack;
    h.i18n.translations.cs.scenarios.lipany_1434.debriefing.unitStatus.texts.alive = attack;
    for (const html of [h.ChronicleView.renderEntries([entry]), h.ChronicleView.exportDocument([entry])]) {
        assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
        assert.doesNotMatch(html, /<script\b|<img\b|<\/p><script/i);
    }
    assert.equal(h.ChronicleSystem.normalizeEntry(entry).note, undefined);
});

test('znovuvykreslení zachová rozbalenou kritiku, export ji rozbalí vždy', async () => {
    const h = await createLocalizedHarness();
    assert.doesNotMatch(h.ChronicleView.renderEntries([legacy()]), /<details[^>]+ open>/);
    assert.match(h.ChronicleView.renderEntries([legacy()], { openEntries: new Set(['0']) }), /<details[^>]+ open>/);
    assert.match(h.ChronicleView.exportDocument([legacy()]), /<details[^>]+ open>/);
});

test('download vytvoří offline Blob a uvolní URL i při chybě; prázdný archiv nestahuje', async () => {
    const h = await createLocalizedHarness();
    assert.equal(h.ChronicleView.download(), false);
    h.ChronicleSystem.record(legacy());
    const calls = []; let blob;
    h.context.Blob = Blob;
    h.context.URL = { createObjectURL(value) { blob = value; calls.push('create'); return 'blob:test'; }, revokeObjectURL(value) { calls.push(value); } };
    const link = h.document.createElement('a'); link.click = () => calls.push('click');
    h.document.createElement = () => link;
    const stored = h.storage.get(h.ChronicleSystem.STORAGE_KEY);
    assert.equal(h.ChronicleView.download(), true);
    assert.equal(link.download, 'husitske-valky-kronika-cs.html');
    assert.equal(blob.type, 'text/html;charset=utf-8');
    assert.match(await blob.text(), /<html lang="cs">/);
    assert.equal(link.parentNode, null);
    await h.advance(1000); assert.deepEqual(calls, ['create', 'click', 'blob:test']);
    link.click = () => { throw new Error('download blocked'); };
    assert.throws(() => h.ChronicleView.download(), /download blocked/);
    await h.advance(1000); assert.equal(calls.at(-1), 'blob:test');
    assert.equal(h.storage.get(h.ChronicleSystem.STORAGE_KEY), stored);
});

test('dialog umí prázdný stav, vstup fokusu, obousměrný Tab a návrat k tlačítku', async () => {
    const h = await createLocalizedHarness(), doc = h.document;
    const opener = doc.getElementById('btn-chronicle'), close = doc.getElementById('chronicle-close');
    const summary = doc.createElement('summary');
    for (const item of [opener, close, summary]) {
        item.isConnected = true; item.focus = () => { doc.activeElement = item; };
    }
    opener.focus(); h.ChronicleView.open();
    assert.equal(doc.activeElement, close);
    assert.equal(doc.getElementById('chronicle-export').disabled, true);
    assert.ok(doc.getElementById('chronicle-list').innerHTML.includes(h.i18n.t('chronicle.empty')));
    h.ChronicleSystem.record(legacy()); h.ChronicleView.render();
    assert.equal(doc.getElementById('chronicle-export').disabled, false);
    doc.getElementById('chronicle-modal').querySelectorAll = () => [close, summary];
    let prevented = 0;
    h.ChronicleView.trapFocus({ shiftKey: true, preventDefault() { prevented++; } });
    assert.equal(doc.activeElement, summary);
    h.ChronicleView.trapFocus({ shiftKey: false, preventDefault() { prevented++; } });
    assert.equal(doc.activeElement, close); assert.equal(prevented, 2);
    h.ChronicleView.close();
    assert.equal(doc.activeElement, opener);
    assert.equal(doc.getElementById('chronicle-modal').classList.contains('hidden'), true);
});

test('všechny nové klíče Kroniky existují v CS/EN, bez fallbacku a prázdných textů', async () => {
    const h = await createLocalizedHarness();
    const cs = h.i18n.translations.cs.chronicle, en = h.i18n.translations.en.chronicle;
    assert.deepEqual(Object.keys(cs).sort(), Object.keys(en).sort());
    for (const locale of [cs, en]) for (const [key, value] of Object.entries(locale)) {
        if (key !== 'actSummaries') assert.equal(typeof value === 'string' && value.trim().length > 0, true, key);
    }
    const source = fs.readFileSync(path.join(__dirname, '../js/ui/main.js'), 'utf8');
    assert.match(source, /languageChanged[\s\S]*ChronicleView\.render\(\)/);
    assert.match(source, /keydown[\s\S]*ChronicleView\.trapFocus\(e\)/);
});

(async () => {
    let failures = 0;
    for (const { name, run } of tests) {
        try { await run(); console.log(`✓ ${name}`); }
        catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
    }
    console.log(`\n${tests.length - failures}/${tests.length} chronicle testů.`);
    if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
