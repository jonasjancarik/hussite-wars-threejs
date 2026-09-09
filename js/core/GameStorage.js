// GitHub Pages projektů pod stejným účtem sdílejí origin, tedy i localStorage.
// Testovací web nesmí číst, migrovat ani mazat data stabilní hry. Na produkční
// adrese zůstávají původní klíče beze změny, i po budoucím sloučení větve.
const GameStorage = (() => {
    let pathname = globalThis.location?.pathname || '/';
    try { pathname = decodeURIComponent(pathname); } catch (_) { /* Použít původní cestu. */ }
    const isTest = /^\/husitske-valky-test(?:\/|$)/.test(pathname);
    const prefix = isTest ? 'husitskeValky_test:' : '';
    const keyFor = key => prefix + key;

    return Object.freeze({
        isTest,
        keyFor,
        // K úložišti přistupovat až při operaci: i samotný getter může vyhodit
        // SecurityError. Volající zachovává vlastní hlášení a obnovu při chybě.
        getItem(key) { return globalThis.localStorage.getItem(keyFor(key)); },
        setItem(key, value) { globalThis.localStorage.setItem(keyFor(key), value); },
        removeItem(key) { globalThis.localStorage.removeItem(keyFor(key)); }
        // Záměrně žádné clear(): nikdy nemažeme celý sdílený origin.
    });
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GameStorage;
