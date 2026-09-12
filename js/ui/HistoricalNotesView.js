// Shared escaped presentation in mission briefing, result and chronicle.
const HistoricalNotesView = {
    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    },

    render(scenarioId, { expanded = false } = {}) {
        const ids = HistoricalSources.scenarios[scenarioId];
        if (!Array.isArray(ids)) return '';
        const e = value => this.escape(value);
        const t = key => e(i18n.t(`history.${key}`));
        const notes = ['documented', 'reconstruction', 'tradition', 'uncertain'].map(kind => {
            const key = `history.scenarios.${scenarioId}.${kind}`;
            if (!i18n.hasTranslation(key) || !i18n.t(key)) return '';
            return `<section class="historical-note"><h4>${t(kind)}</h4><p>${e(i18n.t(key))}</p></section>`;
        }).join('');
        const bibliography = ids.map(id => {
            const source = HistoricalSources.catalog[id];
            if (!source) return '';
            const title = e(source.title);
            const link = /^https:\/\/[^\s<>"']+$/.test(source.url)
                ? `<a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : title;
            return `<li>${link}<span class="historical-source-kind">${t(`sourceKinds.${source.kind}`)}</span></li>`;
        }).join('');
        return `<details class="historical-notes"${expanded ? ' open' : ''}>
            <summary>${t('title')}</summary><p class="historical-notice">${t('scope')}</p>
            ${notes}<h4>${t('reading')}</h4><ul class="historical-bibliography">${bibliography}</ul>
            <p class="historical-notice">${t('quotationNotice')}</p>
        </details>`;
    },

    mount(element, scenarioId) {
        if (element) element.innerHTML = this.render(scenarioId);
    }
};
