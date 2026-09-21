(function () {
    'use strict';
    const q = selector => document.querySelector(selector);
    function command(action, extra = {}) {
        const current = globalThis.SudomerHexBridge.current();
        return JSON.parse(globalThis.SudomerHexBridge.sendCommand(JSON.stringify({ protocolVersion: 1, generation: current.generation, revision: current.revision, action, ...extra })));
    }
    function render(snapshot) {
        const selected = snapshot.units.find(unit => unit.id === snapshot.selectedUnitId);
        const inspected = snapshot.inspection;
        const terrainNames = { plains: 'Firm ground', water: 'Markovec pond', mud: 'Drained pond mud', dam: 'Causeway' };
        q('#battle-state').textContent = `${snapshot.faction === 'hussites' ? 'Your turn' : 'Opponent’s turn'} · round ${snapshot.round}`;
        q('#objective').textContent = snapshot.objective;
        q('#unit-detail').innerHTML = selected
            ? `<strong>${selected.name}</strong><span>${selected.faction === 'hussites' ? 'Hussite' : 'Catholic'} ${selected.unitClass}</span><span>Health ${selected.health}/${selected.maxHealth}</span><span class="meter"><i style="width:${Math.max(0, selected.health / selected.maxHealth * 100)}%"></i></span><span>Morale ${Math.round(selected.morale)}/${selected.maxMorale} · ${selected.hasMoved ? 'moved' : 'movement ready'} · ${selected.hasAttacked ? 'attacked' : 'attack ready'}</span>${inspected?.damagePreview ? `<span class="preview">Against ${inspected.unit.name}: expected damage ${inspected.damagePreview.min}–${inspected.damagePreview.max}${inspected.damagePreview.counter ? ` · counterattack ${inspected.damagePreview.counter.min}–${inspected.damagePreview.counter.max}` : ''}</span>` : ''}`
            : inspected?.unit
                ? `<strong>${inspected.unit.name}</strong><span>${inspected.unit.faction === 'hussites' ? 'Hussite' : 'Catholic'} ${inspected.unit.unitClass} · ${terrainNames[inspected.terrain] || inspected.terrain}</span><span>Health ${inspected.unit.health}/${inspected.unit.maxHealth} · morale ${Math.round(inspected.unit.morale)}/${inspected.unit.maxMorale}</span>${inspected.damagePreview ? `<span>Expected damage ${inspected.damagePreview.min}–${inspected.damagePreview.max}${inspected.damagePreview.counter ? ` · counterattack ${inspected.damagePreview.counter.min}–${inspected.damagePreview.counter.max}` : ''}</span>` : ''}`
                : inspected
                    ? `<strong>${terrainNames[inspected.terrain] || inspected.terrain}</strong><span>Hex ${inspected.col}, ${inspected.row}</span>`
                    : '<strong>No unit selected</strong><span>Select a Hussite group on the board.</span>';
        for (const [name, enabled] of Object.entries(snapshot.actions)) {
            const button = q(`[data-action="${name.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}"]`);
            if (button) button.disabled = !enabled;
        }
        q('#ai-status').hidden = snapshot.faction !== 'crusaders';
        q('#ai-status').style.display = snapshot.faction === 'crusaders' ? 'block' : 'none';
        const result = q('#result');
        result.hidden = !snapshot.result;
        if (snapshot.result) {
            q('#result-text').textContent = snapshot.result.message || (snapshot.result.isVictory ? 'Victory' : 'Defeat');
            if (!result.open) result.showModal();
        } else if (result.open) {
            result.close();
        }
        q('#diagnostic').textContent = `rev ${snapshot.revision} · ${snapshot.tiles.length} tiles · ${snapshot.units.length} visible units`;
    }
    addEventListener('sudomer-snapshot', event => render(event.detail));
    addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => command(button.dataset.action)));
        q('#restart-result').addEventListener('click', () => command('restart'));
        q('#camera-reset').addEventListener('click', () => globalThis.SudomerHexRenderer?.frameScene());
        q('#grid-toggle').addEventListener('click', event => {
            const pressed = event.currentTarget.getAttribute('aria-pressed') !== 'true';
            event.currentTarget.setAttribute('aria-pressed', String(pressed));
            event.currentTarget.textContent = pressed ? 'Hide grid' : 'Show grid';
            globalThis.SudomerHexRenderer?.setGridVisible(pressed);
        });
    });
    globalThis.SudomerHexPanels = { command, render };
})();
