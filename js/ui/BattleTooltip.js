// Tooltip čte stejná pravidla viditelnosti a souboje jako herní akce.
class BattleTooltip {
    constructor(game) {
        this.game = game;
        this.tooltip = document.getElementById('tooltip');
        this.lastHoveredHex = null;
        this.lastTooltipContent = null;
    }

    handleMouseMove(event) {
        if (this.game.view.mapInput?.pointers.size || this.game.view.orders?.isCompact()) return;
        const { x, y } = this.game.view.mapInput.screenToWorld(event.clientX, event.clientY);

        const hex = this.game.hexGrid.pixelToHex(x, y);

        if (!hex) {
            this.hideTooltip();
            return;
        }

        // Kontrola, zda jsme na stejném hexu
        if (this.lastHoveredHex &&
            this.lastHoveredHex.col === hex.col &&
            this.lastHoveredHex.row === hex.row) {
            // Tooltip již je zobrazen, není potřeba jej aktualizovat
            return;
        }

        this.lastHoveredHex = hex;
        this.showTooltip(hex, event.clientX, event.clientY);
    }

    showTooltip(hex, mouseX, mouseY) {
        const html = this.contentForHex(hex);
        if (!html) { this.hideTooltip(); return; }
        if (html !== this.lastTooltipContent) {
            this.tooltip.innerHTML = html;
            this.lastTooltipContent = html;
        }
        this.tooltip.classList.remove('hidden');
        this.positionTooltip(mouseX, mouseY);
    }

    contentForHex(hex) {
        // Mlha války: neprozkoumaný hex neprozrazuje vůbec nic
        if (this.game.fogOfWar && !this.game.fogOfWarSystem.isHexExplored(hex.col, hex.row)) {
            return '';
        }

        let unit = this.game.getUnitAt(hex.col, hex.row);
        // Nepřítel skrytý v mlze se v tooltipu chová, jako by tam nebyl
        if (unit && !this.game.fogOfWarSystem.isEnemyVisible(unit)) {
            unit = null;
        }
        const terrain = this.game.hexGrid.getTerrain(hex.col, hex.row);

        let html = '';

        if (unit) {
            const factionName = i18n.t(`factions.${unit.faction}`);
            const healthPercent = Math.round((unit.health / unit.maxHealth) * 100);

            // Získej viditelnost jednotky
            const visionRange = this.game.fogOfWarSystem.getUnitSightRange(unit);

            html = `
                <div class="tooltip-title">${unit.name}</div>
                <div class="tooltip-faction">${factionName}</div>
                <div class="tooltip-stats">
                    <div class="tooltip-stat"><span class="label">HP:</span> ${unit.health}/${unit.maxHealth}</div>
                    <div class="tooltip-stat"><span class="label">${i18n.t('help.unitStats.attack')}:</span> ${unit.attack}</div>
                    <div class="tooltip-stat"><span class="label">${i18n.t('help.unitStats.defense')}:</span> ${unit.defense}</div>
                    <div class="tooltip-stat"><span class="label">${i18n.t('help.unitStats.range')}:</span> ${unit.special === 'reach' && unit.range === 1 ? '1-2' : unit.range}</div>
                    <div class="tooltip-stat"><span class="label">${i18n.t('help.unitStats.movement')}:</span> ${unit.movement}</div>
                    <div class="tooltip-stat"><span class="label">👁 ${i18n.t('tooltip.visibility')}:</span> ${visionRange}</div>
                </div>
            `;

            // Speciální schopnost (přeskočíme commander - ten má vlastní sekci)
            if (unit.special && unit.special !== 'commander') {
                const specialKey = `special.${unit.special}`;
                const specialName = i18n.hasTranslation(specialKey) ? i18n.t(specialKey) : unit.special;
                html += `<div class="tooltip-special">${specialName}</div>`;
            }

            // Velitel - speciální zobrazení
            if (unit.special === 'commander' || unit.unitClass === 'commander') {
                html += `<div class="tooltip-special" style="color: #ffd700;">👑 ${i18n.t('tooltip.commander')}</div>`;
            } else {
                // Aura velitele - jednotka v dosahu spřáteleného velitele dostává bonus
                const aura = this.game.getCommanderBonuses(unit);
                if (aura && (aura.attack || aura.defense || aura.morale)) {
                    const parts = [];
                    if (aura.attack) parts.push(i18n.t('tooltip.attackBonus', { value: aura.attack }));
                    if (aura.defense) parts.push(i18n.t('tooltip.defenseBonus', { value: aura.defense }));
                    if (aura.morale) parts.push(i18n.t('tooltip.moraleBonus', { value: aura.morale }));
                    html += `<div class="tooltip-bonus">👑 ${i18n.t('tooltip.inAura')}: ${aura.commander} (${parts.join(', ')})</div>`;
                }
            }

            if (unit.isDefending) {
                html += `<div class="tooltip-bonus">${i18n.t('tooltip.defensiveStance')}</div>`;
            }

            if (unit.isTerrified) {
                html += `<div class="tooltip-debuff">${i18n.t('tooltip.terrified')}</div>`;
            }

            // Morálka
            html += `<div class="tooltip-morale" style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #444;">
                <span class="label">${i18n.t('game.moraleLabel')}:</span>
                <span style="color: ${unit.getMoraleColor()}">${unit.getMoraleStatus()} (${Math.round(unit.morale)}%)</span>
            </div>`;

            if (unit.isRouting) {
                html += `<div class="tooltip-debuff" style="color: #ff4444; font-weight: bold;">🏃 ${i18n.t('tooltip.routing')}</div>`;
            }

            // Informace o zbývajících útocích pro rapidFire
            if (unit.special === 'rapidFire' && unit.attackCount > 0 && unit.attackCount < 2) {
                html += `<div class="tooltip-info">${i18n.t('tooltip.attacksRemaining', { count: 2 - unit.attackCount })}</div>`;
            }

            // Náhled šancí při útoku - pokud je vybraná jednotka a toto je nepřítel
            if (this.game.selectedUnit && this.game.selectedUnit.faction !== unit.faction) {
                const p = this.game.combatSystem.calculateDamagePreview(this.game.selectedUnit, unit);
                if (p) {
                    const dmg = p.min === p.max ? `${p.min}` : `${p.min} - ${p.max}`;
                    let killLine = '';
                    if (p.killsCertain) {
                        killLine = `<div class="damage-range" style="color: #ff6b6b; font-weight: bold;">💀 ${i18n.t('tooltip.killsTarget')}</div>`;
                    } else if (p.killsPossible) {
                        killLine = `<div class="damage-range" style="color: #ffb86b;">${i18n.t('tooltip.mayKill')}</div>`;
                    }
                    let counterLine = '';
                    if (p.counter) {
                        const c = p.counter.min === p.counter.max ? `${p.counter.min}` : `${p.counter.min} - ${p.counter.max}`;
                        const counterKill = p.counter.killsAttackerCertain
                            ? ` <span style="color: #ff6b6b; font-weight: bold;">${i18n.t('tooltip.attackerFalls')}</span>`
                            : (p.counter.killsAttackerPossible ? ` <span style="color: #ffb86b;">${i18n.t('tooltip.deathRisk')}</span>` : '');
                        counterLine = `<div class="damage-range" style="color: #ff9999;">↩️ ${i18n.t('tooltip.counterattack', { damage: c })}${counterKill}</div>`;
                    }
                    html += `
                        <div class="tooltip-damage-preview">
                            <div class="damage-title">⚔️ ${i18n.t('tooltip.damageEstimate')}</div>
                            <div class="damage-value">${dmg} HP</div>
                            ${killLine}
                            ${counterLine}
                        </div>
                    `;
                }
            }
        }

        // Přidat info o terénu
        const hasFrozenRiver = this.game.currentScenario?.specialMechanics?.frozenRiver;

        const terrainNames = {
            plains: i18n.t('terrain.plains'),
            forest: i18n.t('terrain.forest'),
            hills: i18n.t('terrain.hills'),
            water: hasFrozenRiver ? i18n.t('tooltip.frozenRiver') : i18n.t('terrain.water'),
            town: i18n.t('terrain.town'),
            road: i18n.t('terrain.road'),
            road2: i18n.t('terrain.road'),
            dam: i18n.t('terrain.dam'),
            mud: i18n.t('terrain.mud'),
            swamp: i18n.hasTranslation('terrain.swamp') ? i18n.t('terrain.swamp') : i18n.t('terrain.mud'),
            slope: i18n.t('terrain.slope'),
            trenches: i18n.t('terrain.trenches'),
            church: i18n.t('terrain.church')
        };

        const terrainBonuses = {
            plains: '',
            forest: i18n.t('tooltip.defenseModifier', { value: '+20' }),
            hills: i18n.t('tooltip.defenseModifier', { value: '+30' }),
            water: hasFrozenRiver ? i18n.t('tooltip.thinIce') : i18n.t('tooltip.impassable'),
            town: i18n.t('tooltip.defenseModifier', { value: '+40' }),
            road: i18n.t('tooltip.fastMovement'),
            road2: i18n.t('tooltip.fastMovement'),
            dam: i18n.t('tooltip.defenseModifier', { value: '+20' }),
            mud: i18n.t('tooltip.slows'),
            swamp: `${i18n.t('tooltip.slows')}, ${i18n.t('tooltip.defenseModifier', { value: '+10' })}`,
            slope: i18n.t('tooltip.defenseModifier', { value: '+10' }),
            trenches: i18n.t('tooltip.defenseModifier', { value: '+30' }),
            church: i18n.t('tooltip.defenseModifier', { value: '+20' })
        };

        // Najdi map label pro tento hex
        const mapLabel = (this.game.hexGrid.mapLabels || []).find(l =>
            l.hexes && l.hexes.some(([c, r]) => c === hex.col && r === hex.row)
        );
        const locationName = mapLabel ? mapLabel.text : null;

        // Terénní modifikátory KONKRÉTNÍ jednotky (skutečná čísla, co počítá souboj),
        // ne generická. U střelců z kopce se tím ukáže i útočný bonus z výšiny.
        let terrainLines;
        if (unit) {
            const tDef = Math.round(unit.getTerrainDefenseBonus(terrain) * 100);
            const tAtk = Math.round(unit.getTerrainAttackBonus(terrain) * 100);
            const line = (val, key, extra = '') => !val ? '' :
                `<div class="tooltip-bonus"${val < 0 ? ' style="color: #b02323"' : ''}>${i18n.t(key, { value: val > 0 ? `+${val}` : val })}${extra}</div>`;
            const highGround = (terrain === 'hills' || terrain === 'slope') && tAtk > 0 && unit.isRanged();
            const moveNote = { road: i18n.t('tooltip.fastMovement'), road2: i18n.t('tooltip.fastMovement'),
                mud: i18n.t('tooltip.slows'), swamp: i18n.t('tooltip.slows'), slope: i18n.t('tooltip.slows'),
                water: hasFrozenRiver ? i18n.t('tooltip.thinIce') : i18n.t('tooltip.impassable') }[terrain];
            terrainLines = line(tDef, 'tooltip.defenseModifier')
                + line(tAtk, 'tooltip.attackModifier', highGround ? i18n.t('tooltip.highGroundSuffix') : '')
                + (moveNote ? `<div class="tooltip-bonus" style="color: #6b5c38">${moveNote}</div>` : '');
        } else {
            terrainLines = terrainBonuses[terrain] ? `<div class="tooltip-bonus">${terrainBonuses[terrain]}</div>` : '';
        }

        html += `
            <div class="tooltip-terrain">
                <strong>${locationName || terrainNames[terrain] || terrain}</strong>
                ${terrainLines}
            </div>
        `;

        return html;
    }

    positionTooltip(mouseX, mouseY) {
        const mapContainer = document.getElementById('map-container');
        const containerRect = mapContainer.getBoundingClientRect();

        // Větší offset od kurzoru pro lepší stabilitu
        const offset = 20;

        // Pozice relativní k map-container + scroll offset
        let left = mouseX - containerRect.left + mapContainer.scrollLeft + offset;
        let top = mouseY - containerRect.top + mapContainer.scrollTop + offset;

        // Kontrola přetečení (relativně k viditelné oblasti)
        const tooltipRect = this.tooltip.getBoundingClientRect();
        if (mouseX + tooltipRect.width + offset > containerRect.right) {
            left = mouseX - containerRect.left + mapContainer.scrollLeft - tooltipRect.width - offset;
        }
        if (mouseY + tooltipRect.height + offset > containerRect.bottom) {
            top = mouseY - containerRect.top + mapContainer.scrollTop - tooltipRect.height - offset;
        }

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }

    hideTooltip() {
        this.tooltip.classList.add('hidden');
        this.lastHoveredHex = null;
        this.lastTooltipContent = null; // Vyčistit cache
    }
}
