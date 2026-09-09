// Společná validace pro zápis i načtení bitvy z hlavního menu, herního menu i pauzy.
// Nejprve ověří celý snapshot, teprve pak přepíše save nebo zruší původní instanci.
const SaveGameSystem = {
    STORAGE_KEY: 'husitskeValky_save',
    AUTO_KEY: 'husitskeValky_autosave',
    VERSION: 4,

    prepare(data) {
        const invalid = () => { throw new Error('gameLog.saveIncompatible'); };
        const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
        const nonnegative = value => Number.isFinite(value) && value >= 0;
        const counts = value => object(value) && Object.values(value).every(nonnegative);
        if (!object(data) || ![1, 2, 3, this.VERSION].includes(data.version)) invalid();
        if (!Number.isInteger(data.turnNumber) || data.turnNumber < 1) invalid();
        if (!['hussites', 'crusaders'].includes(data.currentFaction) || !['playing', 'victory'].includes(data.gameState)) invalid();
        if (!Array.isArray(data.units)) invalid();
        const scenario = data.scenarioId ? ScenarioManager.getScenario(data.scenarioId) : null;
        if (data.scenarioId && !scenario) invalid();
        const { width, height } = scenario?.mapSize || { width: 16, height: 10 };
        const position = (col, row) => Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0 && col < width && row < height;
        const ids = new Set(), occupied = new Set();
        const units = data.units.map(item => {
            if (!object(item) || !Object.prototype.hasOwnProperty.call(UnitTypes, item.type)) invalid();
            if (!Number.isInteger(item.id) || item.id < 1 || ids.has(item.id)) invalid();
            if (!position(item.col, item.row) || !Number.isFinite(item.health)) invalid();
            if (item.faction !== undefined && !['hussites', 'crusaders'].includes(item.faction)) invalid();
            for (const key of ['attack', 'defense', 'movement', 'morale', 'attackCount', 'rallyAttempts', 'breachedTurns']) {
                if (item[key] !== undefined && !nonnegative(item[key])) invalid();
            }
            for (const key of ['hasMoved', 'hasAttacked', 'isDefending', 'isTerrified', 'isRouting', 'isReinforcement', 'formationClosed', 'marching', 'escaped', '_deathCounted', '_deathHandled']) {
                if (item[key] !== undefined && typeof item[key] !== 'boolean') invalid();
            }
            const key = `${item.col},${item.row}`;
            if (item.health > 0 && occupied.has(key)) invalid();
            if (item.health > 0) occupied.add(key);
            ids.add(item.id);
            return Unit.deserialize(item);
        });
        for (const key of ['enemiesKilled', 'unitsLost', 'escapedUnits', 'initialPlayerUnits', 'initialEnemyUnits', 'elapsedGameTime', 'choralTurnsRemaining', 'campaignReputation']) {
            if (data[key] !== undefined && !nonnegative(data[key])) invalid();
        }
        if (data.nextUnitId !== undefined && (!Number.isInteger(data.nextUnitId) || data.nextUnitId < 1)) invalid();
        for (const key of ['bridgeUsedThisTurn', 'campaignRecorded', 'chronicleRecorded', 'fastForwardAI', 'choralUsed', 'choralActive', 'moraleBroken', 'fogOfWar']) {
            if (data[key] !== undefined && typeof data[key] !== 'boolean') invalid();
        }
        if (data.wavering !== undefined && (!object(data.wavering) ||
            !['hussites', 'crusaders'].every(faction => typeof data.wavering[faction] === 'boolean'))) invalid();
        for (const key of ['objectiveHeldTurns', 'lossesByFaction', 'fledByFaction']) {
            if (data[key] !== undefined && !counts(data[key])) invalid();
        }
        for (const key of ['processedEvents', 'exploredHexes']) {
            if (data[key] !== undefined && (!Array.isArray(data[key]) || !data[key].every(item => typeof item === 'string'))) invalid();
        }
        if (data.stats !== undefined && (!object(data.stats) || !nonnegative(data.stats.totalDamage) ||
            !nonnegative(data.stats.damageTaken) || !counts(data.stats.unitKills) || !counts(data.stats.unitDamage))) invalid();
        if (data.aiStance !== undefined && (!object(data.aiStance) ||
            !['default', 'aggressive', 'hold', 'defensive', 'lure', 'retreat'].includes(data.aiStance.mode) ||
            (data.aiStance.untilTurn != null && !nonnegative(data.aiStance.untilTurn)) ||
            (data.aiStance.proximity !== undefined && !nonnegative(data.aiStance.proximity)) ||
            (data.aiStance.target != null && !position(data.aiStance.target.col, data.aiStance.target.row)))) invalid();
        if (data.terrain !== undefined) {
            const types = new Set(['plains', 'forest', 'hills', 'water', 'town', 'road', 'road2', 'dam', 'mud', 'swamp', 'slope', 'trenches', 'church']);
            if (!Array.isArray(data.terrain) || !data.terrain.every(hex => Array.isArray(hex) &&
                hex.length === 3 && position(hex[0], hex[1]) && types.has(hex[2]))) invalid();
        }
        return { data, scenario, units, width, height };
    },

    write(data, { automatic = false } = {}) {
        const raw = JSON.stringify(data);
        // Ověřit přesně to, co se bude později načítat, včetně účinků serializace.
        // Při chybě se k setItem vůbec nedostaneme a poslední dobrý save zůstane.
        this.prepare(JSON.parse(raw));
        GameStorage.setItem(automatic ? this.AUTO_KEY : this.STORAGE_KEY, raw);
        return raw;
    },

    // Dokončená bitva může odstranit jen svůj poslední checkpoint. Jiná karta
    // prohlížeče ani ruční save se nesmějí ztratit; selhání úložiště neblokuje konec.
    finishAutomatic(expectedRaw) {
        if (!expectedRaw) return;
        try {
            if (GameStorage.getItem(this.AUTO_KEY) === expectedRaw) GameStorage.removeItem(this.AUTO_KEY);
        } catch (_) { /* Výsledky bitvy jsou důležitější než úklid checkpointu. */ }
    },

    read({ automatic = false } = {}) {
        const raw = GameStorage.getItem(automatic ? this.AUTO_KEY : this.STORAGE_KEY);
        if (!raw) throw new Error('gameLog.noSaveFound');
        let data;
        try { data = JSON.parse(raw); }
        catch (_) { throw new Error('gameLog.saveIncompatible'); }
        return this.prepare(data);
    },

    load(canvas, currentGame = null, { viewFactory = currentGame?.viewFactory, automatic = false } = {}) {
        const prepared = this.read({ automatic });
        if (currentGame) currentGame.destroy();
        const grid = new HexGrid(canvas, prepared.width, prepared.height, 40);
        const game = new Game(grid, { viewFactory });
        if (prepared.scenario) {
            game.initGameWithScenario(prepared.scenario, { restoring: true });
        } else {
            game.initGame();
        }
        game.restoreSavedState(prepared);
        return game;
    }
};
