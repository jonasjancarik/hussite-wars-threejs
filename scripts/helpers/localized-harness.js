const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness } = require('./game-harness');

// Skutečné locale, překladač, overlay i Kronika. Sdílené narativními a UI testy.
async function createLocalizedHarness(language = 'cs', options = {}) {
    const h = createHarness(options);
    h.document.documentElement = { lang: 'cs' };
    for (const file of ['i18n/i18n.js', 'i18n/i18nHelpers.js', 'data/battleLore.js', 'systems/ChronicleSystem.js', 'ui/ChronicleView.js']) {
        const filename = path.join(__dirname, '../../js', file);
        vm.runInContext(fs.readFileSync(filename, 'utf8'), h.context, { filename });
    }
    Object.assign(h, vm.runInContext('({ i18n, getLocalizedScenario, ChronicleSystem, ChronicleView })', h.context));
    for (const lang of ['cs', 'en']) {
        h.i18n.translations[lang] = JSON.parse(fs.readFileSync(path.join(__dirname, `../../js/i18n/locales/${lang}.json`), 'utf8'));
        h.i18n.loadedLanguages.add(lang);
    }
    await h.i18n.setLanguage(language);
    return h;
}

module.exports = { createLocalizedHarness };
