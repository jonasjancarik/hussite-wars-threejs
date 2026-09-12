// Jediná prezentace Kroniky pro herní modal i samostatný offline dokument.
// Každý text prochází escapováním; uložená data se nikdy nevkládají jako HTML.
const ChronicleView = {
    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    },

    renderEntries(entries, { expanded = false, openEntries = new Set() } = {}) {
        const e = value => this.escape(value);
        const t = key => e(i18n.t(`chronicle.${key}`));
        const safe = entries.map(entry => ChronicleSystem.normalizeEntry(entry)).filter(Boolean);
        if (!safe.length) return `<p class="chronicle-empty">${t('empty')}</p>`;
        return ChronicleSystem.sortEntries(safe).map((entry, index) => {
            if (entry.type === 'actSummary') {
                const summary = ChronicleSystem.generateActSummary(entry);
                return `<article class="chronicle-entry chronicle-act-summary">
                    <h3>${e(summary.title)}</h3><p class="chronicle-text">${e(summary.text)}</p>
                </article>`;
            }
            const scenario = ScenarioManager.getScenario(entry.scenarioId);
            return `<article class="chronicle-entry chronicle-${entry.result}">
                <header class="chronicle-entry-header">
                    <h3>${e(scenario.name)}</h3>
                    <p class="chronicle-meta">${e(scenario.date)} · ${e(i18n.t(`gameover.${entry.result}`))} · ${e(i18n.t('chronicle.turnCount', { n: entry.turns }))}</p>
                </header>
                <h4 class="chronicle-voice-label">${t('chroniclerVoice')}</h4>
                <p class="chronicle-caption">${t('fictionNotice')}</p>
                <p class="chronicle-text">${e(ChronicleSystem.generateText(entry))}</p>
                <details class="chronicle-critique" data-entry="${index}"${expanded || openEntries.has(String(index)) ? ' open' : ''}>
                    <summary>${t('sourceCritic')} <span>${t('compareHint')}</span></summary>
                    <section class="chronicle-facts">
                        <h4>${t('battlefieldRecord')}</h4>
                        <p>${e(ChronicleSystem.truthText(entry))}</p>
                        <p class="chronicle-caption">${t('unitScaleNote')}</p>
                    </section>
                    <section class="chronicle-epilogue">
                        <h4>${t('personalEpilogue')}</h4>
                        <p class="chronicle-caption">${t('epilogueNotice')}</p>
                        <p class="chronicle-text">${e(ChronicleSystem.getPersonalEpilogue(entry))}</p>
                    </section>
                    ${HistoricalNotesView.render(entry.scenarioId, { expanded })}
                </details>
            </article>`;
        }).join('');
    },

    render() {
        const list = document.getElementById('chronicle-list');
        const entries = ChronicleSystem.getEntries();
        const openEntries = new Set(Array.from(list.querySelectorAll('details[open]'), item => item.dataset.entry));
        list.innerHTML = this.renderEntries(entries, { openEntries });
        document.getElementById('chronicle-summary').textContent = ChronicleSystem.getSummary(entries);
        document.getElementById('chronicle-export').disabled = entries.length === 0;
        document.getElementById('chronicle-export-status').textContent = '';
    },

    open() {
        this.returnFocus = document.activeElement;
        this.render();
        document.getElementById('chronicle-modal').classList.remove('hidden');
        document.getElementById('chronicle-close').focus();
    },

    close() {
        document.getElementById('chronicle-modal').classList.add('hidden');
        if (this.returnFocus?.isConnected) this.returnFocus.focus();
        this.returnFocus = null;
    },

    // Tab nesmí pod modalem vybírat jednotky ani opustit otevřený dialog.
    trapFocus(event) {
        const controls = Array.from(document.getElementById('chronicle-modal').querySelectorAll('button:not(:disabled), summary, a[href]'))
            .filter(element => element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    },

    exportDocument(entries) {
        const e = value => this.escape(value);
        // Dokument je bez skriptů, fontů, obrázků i odkazů na lokální server.
        // Všechny komentáře jsou rozbalené a při tisku nezmizí pod <details>.
        return `<!doctype html>
<html lang="${e(i18n.getCurrentLanguage())}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${e(i18n.t('chronicle.exportTitle'))}</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; background: #eee5d2; color: #30271b; font: 17px/1.7 Georgia, serif; }
main { max-width: 840px; margin: 0 auto; padding: 44px 24px; }
h1 { font-size: 2.3rem; line-height: 1.2; margin: 0 0 16px; }
h2, h3, h4 { line-height: 1.4; color: #563d22; }
h3 { font-size: 1.35rem; margin: 0; }
h4 { margin: 20px 0 6px; }
p { margin: 8px 0 16px; }
.chronicle-entry { margin: 28px 0; padding: 24px; background: #fffaf0; border: 1px solid #b9a789; border-left: 5px solid #6b7753; border-radius: 4px; }
.chronicle-defeat { border-left-color: #933d32; }
.chronicle-act-summary { border-left-color: #987232; background: #e8dcc0; }
.chronicle-meta, .chronicle-caption { color: #665743; font: 0.88rem/1.6 system-ui, sans-serif; }
.chronicle-text, .chronicle-facts p { white-space: pre-line; }
.chronicle-critique { border-top: 1px solid #cdbc9f; margin-top: 20px; padding-top: 16px; }
summary { cursor: pointer; color: #593e22; font-weight: bold; }
summary span { display: none; }
.historical-notes { margin-top: 20px; border-top: 1px solid #cdbc9f; padding-top: 16px; }
.historical-notice, .historical-source-kind { font: 0.85rem/1.6 system-ui, sans-serif; color: #665743; }
.historical-source-kind { display: block; }
.historical-bibliography li { margin: 10px 0; overflow-wrap: anywhere; }
a { color: #6c332b; }
.chronicle-facts { padding: 1px 16px; background: #e8eddf; border-radius: 4px; }
@media (max-width: 480px) { main { padding: 24px 14px; } .chronicle-entry { padding: 16px; } }
@media print { body { background: white; } main { max-width: none; padding: 0; } .chronicle-entry { background: white; } h3, h4, summary { break-after: avoid; } p { orphans: 3; widows: 3; } }
</style></head>
<body><main><header><h1>${e(i18n.t('chronicle.exportTitle'))}</h1>
<p>${e(i18n.t('chronicle.subtitle'))}</p><p class="chronicle-caption">${e(i18n.t('chronicle.exportNotice'))}</p>
<p>${e(ChronicleSystem.getSummary(entries))}</p></header>
${this.renderEntries(entries, { expanded: true })}
</main></body></html>`;
    },

    download() {
        const entries = ChronicleSystem.getEntries();
        if (!entries.length) return false;
        const blob = new Blob([this.exportDocument(entries)], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        try {
            link.href = url;
            link.download = `husitske-valky-kronika-${i18n.getCurrentLanguage()}.html`;
            document.body.appendChild(link);
            link.click();
        } finally {
            link.remove();
            // Prohlížeč musí mít čas URL převzít; po stažení nesmí zůstat v paměti.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        return true;
    }
};
