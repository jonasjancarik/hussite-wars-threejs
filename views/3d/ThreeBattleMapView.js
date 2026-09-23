// Adaptér 3D mapy. Herní stav pouze čte a všechny rozkazy vrací do Game.
class ThreeBattleMapView {
    constructor(view) {
        this.view = view;
        this.game = view.game;
        this.canvas = document.getElementById('game-canvas-3d');
        this.surface = document.getElementById('map-surface');
        this.loadingScreen = document.getElementById('three-view-loading');
        this.renderer = null;
        this.starting = null;
        this.cancelFactoryWait = null;
        this.active = false;
        this.pageVisible = !document.hidden;
        this.destroyed = false;
        this.revision = 0;
        this.renderQueued = false;
        this.effectCounter = 0;
        this.effects = [];
        this.terrainSignature = null;
        this.gridVisible = true;
        this.bannerAvoidance = false;
        this.bannerDetails = false;
        this.unitLabelsVisible = true;
        this.depthOfFieldEnabled = true;
        this.closeupFocusStrength = 0.8;
        this.focusQuality = 'compact';
        this.weatherEnabled = true;
        this.quality = 'auto';
    }

    async mount() {
        if (this.destroyed) return false;
        this.active = true;
        this.surface.classList.add('three-view-active');
        this.canvas.hidden = false;
        this.setLoading(!this.renderer);
        this.game.hexGrid.canvas.hidden = true;
        this.view.mapInput.cancel();
        this.view.orders.cancel();
        try {
            await this.ensureRenderer();
            if (this.destroyed || !this.active) return false;
            this.renderer.setActive(this.pageVisible);
            this.resize();
            this.render();
            this.setLoading(false);
            return true;
        } catch (error) {
            this.handleRendererFailure(error);
            return false;
        }
    }

    unmount() {
        this.active = false;
        this.renderer?.setActive(false);
        this.setLoading(false);
        this.canvas.hidden = true;
        this.game.hexGrid.canvas.hidden = false;
        this.surface.classList.remove('three-view-active');
        this.view.hideTooltip();
    }

    async ensureRenderer() {
        if (this.renderer) return this.renderer;
        if (this.starting) return this.starting;
        this.starting = (async () => {
            const factory = await this.waitForFactory();
            const initialSnapshot = this.snapshot();
            const renderer = await factory.create(this.canvas, {
                snapshot: initialSnapshot,
                assetBase: 'assets/3d/',
                artManifestBase: 'assets/3d/scenarios/',
                onHex: ({ col, row }) => {
                    if (!this.active || this.destroyed) return;
                    const hex = { col, row };
                    if (this.view.orders.isCompact()) this.view.orders.tap(hex);
                    else { this.view.orders.cancel(); this.game.handleHexClick(hex); }
                },
                onHover: payload => {
                    if (!this.active || this.destroyed) return;
                    if (!payload) this.view.hideTooltip();
                    else this.view.tooltip.showTooltip(
                        { col: payload.col, row: payload.row }, payload.clientX, payload.clientY
                    );
                },
                onContext: () => {
                    if (!this.active || this.destroyed) return;
                    this.view.orders.cancel();
                    this.game.deselectUnit();
                },
                localize: key => i18n.t(`touch.${key}`),
                onZoom: percentage => {
                    if (this.active && !this.destroyed) {
                        document.getElementById('map-zoom-value').textContent = `${percentage}%`;
                    }
                }
            });
            if (this.destroyed) {
                renderer.dispose();
                throw new Error('battle view was destroyed while 3D was loading');
            }
            this.renderer = renderer;
            renderer.setFocusSettings?.(this.depthOfFieldEnabled, this.closeupFocusStrength, this.focusQuality);
            renderer.setGridVisible(this.gridVisible);
            renderer.setBannerAvoidance?.(this.bannerAvoidance);
            renderer.setBannerDetails?.(this.bannerDetails);
            renderer.setUnitLabelsVisible?.(this.unitLabelsVisible);
            renderer.setWeatherEnabled?.(this.weatherEnabled);
            renderer.setQuality?.(this.quality);
            this.terrainSignature = this.getTerrainSignature(initialSnapshot);
            if (!this.active || !this.pageVisible) renderer.setActive(false);
            return renderer;
        })();
        try {
            return await this.starting;
        } finally {
            this.starting = null;
        }
    }

    waitForFactory() {
        if (window.HussiteBattle3D) return Promise.resolve(window.HussiteBattle3D);
        return new Promise((resolve, reject) => {
            let settled = false;
            let script = document.getElementById('hussite-three-bundle');
            const fail = error => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                window.removeEventListener('hussite-three-ready', ready);
                if (!window.HussiteBattle3D) script?.remove();
                this.cancelFactoryWait = null;
                reject(error);
            };
            const timeout = setTimeout(() => fail(new Error('3D renderer bundle did not load')), 15000);
            const ready = () => {
                if (settled || !window.HussiteBattle3D) return;
                settled = true;
                clearTimeout(timeout);
                window.removeEventListener('hussite-three-ready', ready);
                this.cancelFactoryWait = null;
                resolve(window.HussiteBattle3D);
            };
            this.cancelFactoryWait = () => fail(new Error('battle view was destroyed while 3D was loading'));
            window.addEventListener('hussite-three-ready', ready, { once: true });
            let appendScript = false;
            if (!script) {
                script = document.createElement('script');
                script.id = 'hussite-three-bundle';
                script.type = 'module';
                script.src = 'views/3d/integrated/hex-three.js?v=2.56';
                appendScript = true;
            }
            script.addEventListener('load', () => { if (window.HussiteBattle3D) ready(); }, { once: true });
            script.addEventListener('error', () => {
                fail(new Error('3D renderer bundle failed to load'));
            }, { once: true });
            if (appendScript) document.head.appendChild(script);
            if (window.HussiteBattle3D) ready();
        });
    }

    snapshot() {
        const game = this.game;
        const selected = game.selectedUnit;
        const visibleUnits = game.units.filter(unit => unit.health > 0 && (
            unit.faction === 'hussites' || !game.fogOfWar || game.fogOfWarSystem.isEnemyVisible(unit)
        ));
        const legalAttacks = game.hexGrid.attackableHexes.map(target => ({
            col: target.col, row: target.row, unitId: target.id ?? game.getUnitAt(target.col, target.row)?.id ?? -1
        }));
        const attackRangeHexes = [];
        if (selected?.canAttack() && selected.faction === game.currentFaction && game.gameState === 'playing') {
            attackRangeHexes.push(...game.hexGrid.getHexesInRange(selected.col, selected.row, selected.range));
            if (selected.special === 'reach' && selected.range === 1) {
                for (const hex of game.hexGrid.getHexesInRange(selected.col, selected.row, 2)) {
                    if (game.hexGrid.getDistance(selected.col, selected.row, hex.col, hex.row) === 2 &&
                        game.combatSystem.canReachThrough(selected, hex)) {
                        attackRangeHexes.push(hex);
                    }
                }
            }
        }
        return {
            protocolVersion: 2,
            generation: 1,
            revision: ++this.revision,
            scenario: game.currentScenario?.id || 'quick_battle',
            seed: game.currentScenario?.artSeed ?? game.currentScenario?.mapRevision ?? 1,
            cols: game.hexGrid.cols,
            rows: game.hexGrid.rows,
            round: game.turnNumber,
            faction: game.currentFaction,
            state: game.gameState,
            busy: game.actions.busy,
            paused: game.isPaused,
            aiRunning: game.aiRunning,
            fogOfWar: game.fogOfWar,
            tiles: [...game.hexGrid.hexes.values()].map(tile => ({
                col: tile.col, row: tile.row, terrain: tile.terrain
            })),
            // Map labels that name a feature (a tvrz, say): the 3D generator builds them.
            features: (game.hexGrid.mapLabels || []).filter(label => label.kind).map(label => ({
                kind: label.kind, hexes: label.hexes.map(([col, row]) => ({ col, row }))
            })),
            movement: ThreeBattleMapView.movementOf(this.view, visibleUnits),
            units: visibleUnits.map(unit => ({
                id: unit.id, type: unit.type, name: unit.name, faction: unit.faction,
                unitClass: unit.unitClass, col: unit.col, row: unit.row,
                health: unit.health, maxHealth: unit.maxHealth,
                morale: unit.morale, maxMorale: unit.maxMorale,
                hasMoved: unit.hasMoved, hasAttacked: unit.hasAttacked,
                isDefending: unit.isDefending, isRouting: unit.isRouting,
                formationClosed: unit.formationClosed, marching: unit.marching,
                dismounted: Boolean(unit.dismounted),
                special: unit.special,
                commanderAbilities: unit.isCommander()
                    ? { auraRange: unit.getCommanderAbilities()?.auraRange ?? 0 } : null,
                // Visible units only: this contains no extra information about
                // enemies hidden by fog and gives 3D the same token facts as 2D.
                presentation: WoodcutRenderer.unitPresentation(unit)
            })),
            selectedUnitId: selected?.id ?? null,
            legalMoves: game.hexGrid.highlightedHexes.map(({ col, row }) => ({ col, row })),
            legalAttacks,
            attackRangeHexes,
            marchTargets: selected?.isWagon() && selected.marching
                ? game.hexGrid.highlightedHexes.map(({ col, row }) => ({ col, row })) : [],
            objectiveHexes: game.hexGrid.escapeZoneHexes.map(({ col, row }) => ({ col, row })),
            objectiveKind: game.hexGrid.escapeZoneKind,
            visibleHexes: [...game.visibleHexes],
            exploredHexes: [...game.exploredHexes],
            brokenIceHexes: [...(game.brokenIceHexes || [])].filter(key =>
                !game.fogOfWar || game.visibleHexes.has(key) || game.exploredHexes.has(key)
            ),
            events: this.effects,
            // Zero HP can also mean leaving the field. Only the shared death
            // handler confirms a casualty; never infer death from disappearance.
            eliminatedUnitIds: game.units.filter(unit => unit.health <= 0 && unit._deathHandled && !unit.escaped && (
                unit.faction === 'hussites' || !game.fogOfWar || game.fogOfWarSystem.isEnemyVisible(unit)
            )).map(unit => unit.id)
        };
    }

    static movementOf(view, visibleUnits) {
        const animation = view?.moveAnimation;
        if (!animation || !visibleUnits.some(unit => unit.id === animation.unit.id)) return undefined;
        view.moveTokenPosition();
        const progress = animation.elapsed / animation.duration;
        return {
            unitId: animation.unit.id,
            from: { col: animation.fromHex.col, row: animation.fromHex.row },
            to: { col: animation.toHex.col, row: animation.toHex.row },
            progress: progress * progress * (3 - 2 * progress)
        };
    }

    // Animation frames of a move change only the token position. The move's
    // start and end still send full snapshots through render().
    renderMovement() {
        if (!this.active || this.destroyed) return;
        if (!this.renderer?.applyMovement) { this.render(); return; }
        const unit = this.view.moveAnimation?.unit;
        const visible = unit && unit.health > 0 && (unit.faction === 'hussites' || !this.game.fogOfWar ||
            this.game.fogOfWarSystem.isEnemyVisible(unit));
        this.renderer.applyMovement(visible ? ThreeBattleMapView.movementOf(this.view, [unit]) : undefined);
    }

    render() {
        this.renderQueued = false;
        if (!this.active || this.destroyed) return;
        const snapshot = this.snapshot();
        const terrainSignature = this.getTerrainSignature(snapshot);
        if (this.renderer && this.terrainSignature !== terrainSignature) {
            this.renderer.dispose();
            this.renderer = null;
            this.terrainSignature = null;
            this.effects = [];
            this.setLoading(true);
        }
        if (!this.renderer) {
            void this.ensureRenderer().then(renderer => {
                if (this.active && !this.destroyed) {
                    renderer.applySnapshot(this.snapshot());
                    this.setLoading(false);
                }
            }).catch(error => {
                this.handleRendererFailure(error);
            });
            return;
        }
        this.renderer.applySnapshot(snapshot);
    }

    getTerrainSignature(snapshot) {
        return `${snapshot.scenario ?? 'battle'}:${snapshot.seed ?? 1}|` +
            snapshot.tiles.map(tile => `${tile.col},${tile.row}:${tile.terrain}`).join('|');
    }

    setLoading(loading) {
        if (this.loadingScreen) this.loadingScreen.hidden = !loading;
    }

    handleRendererFailure(error) {
        if (this.destroyed) return;
        console.error('3D view could not start:', error);
        this.unmount();
        this.view.setViewMode('2d', { fromFallback: true });
        this.view.showEventNotification(
            i18n.t('touch.view3dUnavailableTitle'),
            i18n.t('touch.view3dUnavailable')
        );
    }

    effect(type, col, row, extra = {}) {
        if (!this.active || this.destroyed) return;
        this.effects.push({
            id: `${this.game.turnNumber}:${this.effectCounter++}:${type}:${col},${row}`,
            type, col, row, ...extra
        });
        if (this.effects.length > 48) this.effects.shift();
        this.queueRender();
    }

    // An attack reports several effects in one go (attack, damage,
    // explosion). Each full snapshot re-reads every tile and unit, so they
    // share one snapshot, built once the current task has finished.
    queueRender() {
        if (this.renderQueued) return;
        this.renderQueued = true;
        queueMicrotask(() => { if (this.renderQueued) this.render(); });
    }

    resize() { if (this.active) this.renderer?.resize(); }
    zoomBy(factor) { this.renderer?.zoomBy(factor); }
    setGridVisible(visible) { this.gridVisible = visible; this.renderer?.setGridVisible(visible); }
    setBannerAvoidance(enabled) { this.bannerAvoidance = enabled; this.renderer?.setBannerAvoidance?.(enabled); }
    setBannerDetails(enabled) { this.bannerDetails = enabled; this.renderer?.setBannerDetails?.(enabled); }
    setUnitLabelsVisible(visible) { this.unitLabelsVisible = visible; this.renderer?.setUnitLabelsVisible?.(visible); }
    setFocusSettings(enabled, closeupStrength, quality = this.focusQuality) {
        this.depthOfFieldEnabled = Boolean(enabled);
        this.closeupFocusStrength = Math.max(0, Math.min(1, Number(closeupStrength) || 0));
        this.focusQuality = quality === 'bokeh' ? 'bokeh' : 'compact';
        this.renderer?.setFocusSettings?.(this.depthOfFieldEnabled, this.closeupFocusStrength, this.focusQuality);
    }
    setQuality(level) {
        this.quality = ['auto', 'high', 'medium', 'low'].includes(level) ? level : 'auto';
        this.renderer?.setQuality?.(this.quality);
    }
    qualityTier() { return this.renderer?.qualityTier?.() ?? null; }
    setWeatherEnabled(enabled) { this.weatherEnabled = Boolean(enabled); this.renderer?.setWeatherEnabled?.(this.weatherEnabled); }
    diagnostics() { return this.renderer?.diagnostics() ?? null; }
    resetDiagnostics() { this.renderer?.resetDiagnostics(); }
    setPageVisible(visible) { this.pageVisible = visible; this.renderer?.setActive(this.active && visible); }
    focusSelection() {
        if (this.game.selectedUnit) this.renderer?.focusHex(this.game.selectedUnit.col, this.game.selectedUnit.row);
        else this.renderer?.frameScene();
    }
    frameScene() { this.renderer?.frameScene(); }
    focusUnit(unit) { if (unit) this.renderer?.focusHex(unit.col, unit.row); }
    setSelection() { this.render(); }

    destroy() {
        this.destroyed = true;
        this.active = false;
        this.cancelFactoryWait?.();
        this.cancelFactoryWait = null;
        this.renderer?.dispose();
        this.renderer = null;
        this.terrainSignature = null;
        this.setLoading(false);
        this.canvas.hidden = true;
        this.game.hexGrid.canvas.hidden = false;
        this.surface.classList.remove('three-view-active');
    }
}
