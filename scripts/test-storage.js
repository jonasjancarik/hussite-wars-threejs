#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness } = require('./helpers/game-harness');
const { createLocalizedHarness } = require('./helpers/localized-harness');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const previewPath = '/husitske-valky-test/';
const keys = ['husitskeValky_save', 'husitskeValky_autosave', 'hussiteCampaignProgress',
    'hussiteChronicle', 'husitskeValky_settings', 'gameLanguage'];

test('stabilní web zachová všechny původní klíče bez migrace', () => {
    const h = createHarness({ pathname: '/husitske-valky/' });
    assert.equal(h.GameStorage.isTest, false);
    for (const key of keys) {
        h.storage.set(key, 'original');
        assert.equal(h.GameStorage.keyFor(key), key);
        assert.equal(h.GameStorage.getItem(key), 'original');
    }
    assert.equal(h.storage.size, keys.length);
});

test('testovací cesta je přesná a rozpozná i index.html a URL kódování', () => {
    for (const pathname of [previewPath, '/husitske-valky-test', `${previewPath}index.html`, '/husitske%2Dvalky-test/']) {
        assert.equal(createHarness({ pathname }).GameStorage.isTest, true, pathname);
    }
    for (const pathname of ['/', '/husitske-valky/', '/husitske-valky-test-old/', '/other/husitske-valky-test/', '/%ZZ/']) {
        assert.equal(createHarness({ pathname }).GameStorage.isTest, false, pathname);
    }
});

for (const key of keys) {
    test(`${key}: test nikdy nečte, nepřepisuje ani nemaže původní data`, () => {
        const storage = new Map([[key, 'original']]);
        const h = createHarness({ pathname: previewPath, storage });
        assert.equal(h.GameStorage.getItem(key), null);
        h.GameStorage.setItem(key, 'preview');
        assert.equal(h.GameStorage.getItem(key), 'preview');
        assert.equal(storage.get(key), 'original');
        const reloaded = createHarness({ pathname: previewPath, storage });
        assert.equal(reloaded.GameStorage.getItem(key), 'preview');
        reloaded.GameStorage.removeItem(key);
        assert.deepEqual([...storage], [[key, 'original']]);
    });
}

test('skutečné ruční savy, autosavy, načtení i úklid bitvy jsou izolované', () => {
    const storage = new Map();
    const stable = createHarness({ pathname: '/husitske-valky/', storage });
    const originalGame = stable.newGame('zivohost_1419');
    originalGame.turnNumber = 3;
    assert.equal(originalGame.saveGame(), true);
    assert.equal(originalGame.saveGame({ automatic: true }), true);
    const original = [...storage];

    const preview = createHarness({ pathname: previewPath, storage });
    const testGame = preview.newGame('zivohost_1419');
    assert.equal(testGame.hasSavedGame(), false);
    assert.throws(() => preview.SaveGameSystem.read(), /noSaveFound/);
    assert.throws(() => preview.SaveGameSystem.read({ automatic: true }), /noSaveFound/);
    testGame.turnNumber = 7;
    assert.equal(testGame.saveGame(), true);
    assert.equal(testGame.saveGame({ automatic: true }), true);
    assert.equal(preview.SaveGameSystem.read().data.turnNumber, 7);
    assert.equal(preview.SaveGameSystem.read({ automatic: true }).data.turnNumber, 7);
    assert.equal(stable.SaveGameSystem.read().data.turnNumber, 3);
    assert.equal(stable.SaveGameSystem.read({ automatic: true }).data.turnNumber, 3);
    testGame.deleteSave();
    preview.SaveGameSystem.finishAutomatic(testGame.lastAutosaveRaw);
    assert.deepEqual([...storage], original);
    originalGame.destroy(); testGame.destroy();
});

test('reset testovací kampaně a kroniky zachová celou původní historii', async () => {
    const storage = new Map();
    const stable = await createLocalizedHarness('cs', { pathname: '/husitske-valky/', storage });
    stable.CampaignProgressSystem.recordBattle({ scenarioId: 'zivohost_1419', result: 'victory', turns: 5 });
    stable.ChronicleSystem.recordActSummary(1);
    const original = [...storage];
    const preview = await createLocalizedHarness('en', { pathname: previewPath, storage });
    assert.equal(preview.CampaignProgressSystem.getBattleRecord('zivohost_1419'), null);
    assert.equal(preview.ChronicleSystem.getEntries().length, 0);
    preview.CampaignProgressSystem.recordBattle({ scenarioId: 'zivohost_1419', result: 'defeat', turns: 8 });
    preview.ChronicleSystem.recordActSummary(2);
    assert.equal(stable.CampaignProgressSystem.getBattleRecord('zivohost_1419').result, 'victory');
    assert.equal(stable.ChronicleSystem.getEntries()[0].actId, 1);
    preview.CampaignProgressSystem.reset(); preview.ChronicleSystem.clear();
    assert.deepEqual([...storage].filter(([key]) => !key.startsWith('husitskeValky_test:')), original);
    assert.equal(preview.CampaignProgressSystem.getBattleRecord('zivohost_1419'), null);
    assert.equal(preview.ChronicleSystem.getEntries().length, 0);
});

test('menu a změna jazyka používají jen preference vlastní verze', async () => {
    const storage = new Map([
        ['gameLanguage', 'cs'], ['husitskeValky_settings', '{"soundVolume":10}']
    ]);
    const h = await createLocalizedHarness('en', { pathname: previewPath, storage });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/main.js'), 'utf8'), h.context);
    const preferences = () => JSON.parse(JSON.stringify(h.context.readGamePreferences()));
    assert.deepEqual(preferences(), {});
    h.GameStorage.setItem('husitskeValky_settings', '{"soundVolume":80}');
    assert.deepEqual(preferences(), { soundVolume: 80 });
    h.context.navigator = { language: 'cs-CZ' };
    await h.i18n.init();
    assert.equal(h.i18n.getCurrentLanguage(), 'en');
    assert.equal(storage.get('gameLanguage'), 'cs');
    assert.equal(storage.get('husitskeValky_settings'), '{"soundVolume":10}');
    assert.match(h.document.title, /^\[TEST\] /);
    await h.i18n.setLanguage('cs');
    assert.match(h.document.title, /^\[TEST\] /);
    assert.ok(h.i18n.t('deployment.testNotice').startsWith('Testovací verze'));
});

test('nedostupné úložiště nespadne při načítání adaptéru a neskrývá chyby zápisu', () => {
    // Samostatný browser-global: Node VM proxy u globálního getteru chybu pohltí.
    const browserGlobal = { location: { pathname: previewPath } };
    Object.defineProperty(browserGlobal, 'localStorage', { get() { throw new Error('SecurityError'); } });
    const context = vm.createContext({ globalThis: browserGlobal });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/GameStorage.js'), 'utf8'), context);
    assert.equal(vm.runInContext('GameStorage.isTest', context), true);
    for (const expression of ['GameStorage.getItem("save")', 'GameStorage.setItem("save", "data")', 'GameStorage.removeItem("save")']) {
        assert.throws(() => vm.runInContext(expression, context), /SecurityError/);
    }
    assert.equal(vm.runInContext('typeof GameStorage.clear', context), 'undefined');
});

test('žádný runtime soubor nesmí obejít společný storage adaptér', () => {
    const root = path.join(__dirname, '../js');
    function check(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) check(file);
            else if (entry.name.endsWith('.js') && file !== path.join(root, 'core/GameStorage.js')) {
                const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
                assert.doesNotMatch(source, /\blocalStorage\b/, path.relative(root, file));
            }
        }
    }
    check(root);
});

(async () => {
    let failures = 0;
    for (const { name, run } of tests) {
        try { await run(); console.log(`✓ ${name}`); }
        catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
    }
    console.log(`\n${tests.length - failures}/${tests.length} testů oddělení úložiště.`);
    if (failures) process.exitCode = 1;
})();
