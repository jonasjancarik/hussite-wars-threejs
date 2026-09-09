#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const importPattern = /@import\s+url\("(styles\/[\w-]+\.css)\?v=([\d.]+)"\);/g;
const imports = [...manifest.matchAll(importPattern)];
// Pořadí je součástí vzhledu. Změna vyžaduje vědomou úpravu tohoto kontraktu.
const cascade = ['base', 'battle', 'dialogs-and-help', 'campaign', 'menu-and-results', 'feedback', 'field-theme', 'touch-and-layout'];
assert.deepEqual(imports.map(match => match[1]), cascade.map(name => `styles/${name}.css`), 'Změněné pořadí, chybějící nebo duplicitní CSS import');
assert.equal(manifest.replace(/\/\*[\s\S]*?\*\//g, '').replace(importPattern, '').trim(), '', 'Manifest smí obsahovat jen deklarované importy');

// Strukturální kontrola, nikoli úplný CSS parser. Řetězce/komentáře mohou obsahovat závorky.
function checkStructure(css, file) {
    let quote = null, comment = false;
    const stack = [], pairs = { '}': '{', ')': '(', ']': '[' };
    for (let i = 0; i < css.length; i++) {
        const char = css[i], next = css[i + 1];
        if (comment) { if (char === '*' && next === '/') { comment = false; i++; } continue; }
        if (quote) { if (char === '\\') i++; else if (char === quote) quote = null; continue; }
        if (char === '/' && next === '*') { comment = true; i++; continue; }
        if (char === '"' || char === "'") { quote = char; continue; }
        if ('{(['.includes(char)) stack.push(char);
        if ('})]'.includes(char)) assert.equal(stack.pop(), pairs[char], `${file}: nevyvážené závorky`);
    }
    assert.ok(!quote && !comment && stack.length === 0, `${file}: nedokončený řetězec, komentář nebo blok`);
}

for (const [, file] of imports) {
    const css = fs.readFileSync(path.join(root, file), 'utf8');
    checkStructure(css, file);
    assert.doesNotMatch(css, /@import\b/, `${file}: další import by skryl pořadí kaskády`);
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\{\s*\}/, `${file}: prázdné pravidlo`);
    for (const [, url] of css.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)) {
        if (/^(data:|https?:|#)/.test(url)) continue;
        assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), url.split('?')[0])), `${file}: chybí asset ${url}`);
    }
}
const files = fs.readdirSync(path.join(root, 'styles')).filter(file => file.endsWith('.css')).map(file => `styles/${file}`).sort();
assert.deepEqual(files, imports.map(match => match[1]).sort(), 'CSS soubor není zapojený do kaskády');
console.log(`✓ ${imports.length} CSS částí: importy, struktura a cesty k assetům`);
