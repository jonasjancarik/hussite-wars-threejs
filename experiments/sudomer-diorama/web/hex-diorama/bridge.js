(function () {
    'use strict';

    const PROTOCOL_VERSION = 1;
    let game = null;
    let view = null;
    let generation = 0;
    let revision = 0;
    let deliveredRevision = -1;
    let lastSnapshot = '';

    function reject(reason) { return JSON.stringify({ ok: false, reason, generation, revision }); }
    function accept(value = true) { return JSON.stringify({ ok: true, value, generation, revision }); }
    function parseCommand(raw) {
        try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
        catch (_) { return null; }
    }
    function unitById(id) { return game?.units.find(unit => unit.id === Number(id) && unit.health > 0) || null; }

    function applyCommand(raw) {
        const command = parseCommand(raw);
        if (!command || command.protocolVersion !== PROTOCOL_VERSION) return reject('protocol');
        if (!game || !view) return reject('not-ready');
        if (command.generation !== generation) return reject('stale-generation');
        if (command.revision !== revision) return reject('stale-revision');
        if (game.gameState !== 'playing' && command.action !== 'restart') return reject('finished');
        if (game.actions.busy && !['pause', 'resume', 'restart', 'fast-forward', 'inspect'].includes(command.action)) return reject('busy');
        if (game.currentFaction !== 'hussites' && !['pause', 'resume', 'restart', 'fast-forward', 'inspect'].includes(command.action)) return reject('ai-turn');
        if (game.isPaused && !['resume', 'restart', 'inspect'].includes(command.action)) return reject('paused');

        const selected = game.selectedUnit;
        let result = false;
        switch (command.action) {
            case 'select': {
                const unit = unitById(command.unitId);
                if (!unit || unit.faction !== 'hussites') return reject('invalid-unit');
                game.selectUnit(unit); result = game.selectedUnit === unit; break;
            }
            case 'hex': {
                if (!Number.isInteger(command.col) || !Number.isInteger(command.row) || !game.hexGrid.inBounds(command.col, command.row)) return reject('invalid-hex');
                game.handleHexClick({ col: command.col, row: command.row }); result = true; break;
            }
            case 'defend':
                if (!selected || !selected.canAct()) return reject('no-selected-unit');
                game.combatSystem.defendSelectedUnit(); result = true; break;
            case 'inspect': {
                if (!Number.isInteger(command.col) || !Number.isInteger(command.row) || !game.hexGrid.inBounds(command.col, command.row)) return reject('invalid-hex');
                const target = game.getUnitAt(command.col, command.row);
                if (target && target.faction !== 'hussites' && game.fogOfWar && !game.fogOfWarSystem.isEnemyVisible(target)) return reject('hidden');
                view.inspect(command.col, command.row); result = true; break;
            }
            case 'undo': result = game.undoLastMove(); break;
            case 'choral': result = game.activateChoral(); break;
            case 'wagon-formation': result = game.toggleWagonFormation(selected); break;
            case 'wagon-line': result = game.toggleWagonFormationLine(selected); break;
            case 'wagon-march': result = game.toggleWagonMarch(selected); break;
            case 'end-turn': result = game.endTurn(); break;
            case 'pause': game.setPaused(true); result = true; break;
            case 'resume': game.setPaused(false); result = true; break;
            case 'fast-forward': result = game.skipAIAnimations(); break;
            case 'restart': globalThis.SudomerHexBoot?.restart(); result = true; break;
            default: return reject('unknown-action');
        }
        if (result === false || result == null) return reject('rejected');
        view.publish('command');
        return accept(result);
    }

    globalThis.SudomerHexBridge = {
        protocolVersion: PROTOCOL_VERSION,
        bind(nextGame, nextView, nextGeneration) {
            game = nextGame; view = nextView; generation = nextGeneration;
            revision = 0; deliveredRevision = -1; lastSnapshot = '';
        },
        publish(snapshot) {
            revision += 1;
            snapshot.protocolVersion = PROTOCOL_VERSION;
            snapshot.generation = generation;
            snapshot.revision = revision;
            lastSnapshot = JSON.stringify(snapshot);
            globalThis.dispatchEvent?.(new CustomEvent('sudomer-snapshot', { detail: snapshot }));
        },
        takeSnapshot() {
            if (deliveredRevision === revision) return '';
            deliveredRevision = revision;
            return lastSnapshot;
        },
        sendCommand: applyCommand,
        current() { return { game, view, generation, revision }; },
        reset() { game = null; view = null; generation += 1; revision = 0; lastSnapshot = ''; }
    };
})();
