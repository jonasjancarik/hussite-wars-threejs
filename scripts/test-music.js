#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/ui/music.js'), 'utf8');
const score = require('./audio/choral-score.json');
const tests = [];
const test = (name, run) => tests.push({ name, run });

function harness() {
    const created = [], requests = [], warnings = [];
    class AudioDouble extends EventTarget {
        constructor(src) {
            super(); this.src = src; this.paused = true; this.ended = false;
            this.currentTime = 0; this.volume = 1; created.push(this);
        }
        play() {
            this.paused = false; this.ended = false;
            this.dispatchEvent(new Event('play'));
            return new Promise((resolve, reject) => requests.push({ resolve, reject }));
        }
        pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
    }
    const window = new EventTarget();
    const context = vm.createContext({ Audio: AudioDouble, window, Event, console: { warn: (...args) => warnings.push(args) } });
    vm.runInContext(source, context);
    const music = window.Music;
    const states = [];
    window.addEventListener('musicstatechange', () => states.push(music.isPlaying));
    return { music, created, requests, warnings, states };
}

test('hudba se nevytváří ani nestahuje při startu nebo nastavování hlasitosti', () => {
    const { music, created } = harness();
    music.setVolume(.23); music.stop(); music.setEnabled(false); music.setEnabled(true);
    assert.equal(created.length, 0);
    music.toggle();
    assert.equal(created.length, 1);
    assert.equal(music.audio.volume, .23);
    assert.equal(music.audio.preload, 'none');
    assert.match(music.audio.src, /-u-ohne\.mp3$/);
});

test('hlasitost zachová nulu, omezí rozsah a ignoruje nečíselné hodnoty', () => {
    const { music } = harness();
    music.setVolume(0); music.init(); assert.equal(music.audio.volume, 0);
    music.setVolume(2); assert.equal(music.audio.volume, 1);
    music.setVolume(-2); assert.equal(music.audio.volume, 0);
    for (const invalid of [NaN, Infinity, undefined, null, '0.5']) music.setVolume(invalid);
    assert.equal(music.audio.volume, 0);
});

test('menu opakuje a pauzuje jedinou nahrávku, obnovení pokračuje na stejném místě', () => {
    const { music, created } = harness();
    assert.equal(music.toggle(), true); assert.equal(music.audio.loop, true);
    music.audio.currentTime = 12;
    assert.equal(music.toggle(), false); assert.equal(music.audio.currentTime, 12);
    assert.equal(music.toggle(), true); assert.equal(music.audio.currentTime, 12);
    assert.equal(created.length, 1);
});

test('stop vrací skladbu na začátek a oznamuje vypnutý stav', () => {
    const { music, states } = harness();
    music.toggle(); music.audio.currentTime = 10; music.stop();
    assert.equal(music.audio.currentTime, 0); assert.equal(music.audio.paused, true);
    assert.equal(music.isPlaying, false); assert.equal(states.at(-1), false);
});

test('bojový chorál začíná od začátku, necyklí se a nevrství další přehrávače', () => {
    const { music, requests, created } = harness();
    music.toggle(); music.audio.currentTime = 14; music.toggle();
    assert.equal(music.playChoral(), true);
    assert.equal(music.audio.currentTime, 0); assert.equal(music.audio.loop, false);
    assert.equal(music.playChoral(), false);
    assert.equal(requests.length, 2); assert.equal(created.length, 1);
});

test('konec chorálu aktualizuje stav a další aktivace je možná', () => {
    const { music } = harness();
    music.playChoral(); music.audio.ended = true; music.audio.paused = true;
    music.audio.dispatchEvent(new Event('ended'));
    assert.equal(music.isPlaying, false);
    assert.equal(music.playChoral(), true);
});

test('ztlumení zastaví hudbu a blokuje i scénářové spuštění, zapnutí samo nehraje', () => {
    const { music, requests } = harness();
    music.toggle(); music.setEnabled(false);
    assert.equal(music.audio.paused, true);
    assert.equal(music.toggle(), false); assert.equal(music.playChoral(), false);
    assert.equal(music.playMelody(), false); assert.equal(requests.length, 1);
    music.setEnabled(true); assert.equal(requests.length, 1);
    assert.equal(music.playChoral(), true);
});

test('autoplay rejection nenechá zapnutý indikátor a lze zopakovat kliknutí', async () => {
    const { music, requests, states, warnings } = harness();
    music.toggle();
    music.audio.paused = true;
    requests[0].reject(new Error('NotAllowedError')); await Promise.resolve();
    assert.equal(music.isPlaying, false); assert.equal(states.at(-1), false);
    assert.equal(warnings.length, 1); assert.equal(music.toggle(), true);
});

test('pozdní odmítnutí starého play nezruší novější přehrávání', async () => {
    const { music, requests, warnings } = harness();
    music.toggle(); music.stop(); music.playChoral();
    requests[0].reject(new Error('AbortError')); await Promise.resolve();
    assert.equal(music.isPlaying, true); assert.equal(warnings.length, 0);
});

test('opožděné pause a ended po rychlém přepnutí nesmažou nový požadavek', () => {
    const { music } = harness();
    music.toggle(); music.toggle(); music.toggle();
    music.audio.dispatchEvent(new Event('pause'));
    music.audio.dispatchEvent(new Event('ended'));
    assert.equal(music.isPlaying, true); assert.equal(music._wanted, true);
});

test('synchronní chyba přehrávače i chyba média vrací vypnutý stav', () => {
    const { music, warnings } = harness();
    music.init().play = () => { throw new Error('Media error'); };
    assert.equal(music.toggle(), false); assert.equal(warnings.length, 1);
    assert.equal(music.isPlaying, false);
    music.audio.dispatchEvent(new Event('error'));
    assert.equal(music.isPlaying, false);
});

test('notový přepis zachovává pět celých frází a 62 dob s otevřeným doprovodem', () => {
    assert.equal(score.phrases.length, 5);
    assert.equal(score.phrases.flat().reduce((sum, [, duration]) => sum + duration, 0), 62);
    assert.deepEqual(score.phrases[0], [['C5',1],['C5',1],['C5',2],['C5',2],['D5',1],['Bb4',1],['Bb4',2],['D5',2]]);
    assert.deepEqual(score.phrases.at(-1).slice(-2), [['D4',2],['D4',4]]);
    let cursor = 0;
    for (const [start, duration, root, fifth] of score.harmony) {
        assert.equal(start, cursor); assert.ok(duration > 0);
        for (const note of [root, fifth]) assert.match(note, /^[A-G][b#]?[0-8]$/);
        cursor += duration;
    }
    assert.equal(cursor, 62);
});

test('všechny samply mají připnutý původ, hash a explicitní výšku', () => {
    assert.equal(score.samples.license, 'CC0-1.0');
    assert.match(score.samples.revision, /^[a-f0-9]{40}$/);
    const entries = Object.values(score.samples.instruments).flat();
    assert.equal(entries.length, 16);
    for (const [pitch, file, hash] of entries) {
        assert.ok(Number.isInteger(pitch) && pitch >= 0 && pitch < 128);
        assert.match(file, /\.wav$/); assert.ok(!file.includes('..'));
        assert.match(hash, /^[a-f0-9]{64}$/);
    }
    assert.equal(score.samples.instruments.harp[0][0], 38, 'harfa D2, nikoli D3');
});

test('nová hudba je lokální hotové MP3 do 1,5 MB s připojenými licenčními podklady', () => {
    const file = path.join(__dirname, '../audio/ktoz-jsu-bozi-bojovnici-u-ohne.mp3');
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.subarray(0, 3).toString(), 'ID3');
    assert.ok(bytes.length > 100000 && bytes.length < 1500000);
    const credits = fs.readFileSync(path.join(__dirname, '../audio/README.md'), 'utf8');
    assert.match(credits, /Versilian Studios/); assert.match(credits, /CC0/);
    assert.doesNotMatch(source, /new Audio\(['"]https?:/);
});

(async () => {
    let failed = 0;
    for (const { name, run } of tests) {
        try { await run(); console.log(`✓ ${name}`); }
        catch (error) { failed++; console.error(`✗ ${name}\n${error.stack}`); }
    }
    console.log(`\n${tests.length - failed}/${tests.length} music testů.`);
    if (failed) process.exitCode = 1;
})();
