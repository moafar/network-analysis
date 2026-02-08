document.addEventListener('DOMContentLoaded', () => {
    // File open button
    const fileOpenBtn = document.getElementById('fileOpenBtn');
    const fileInput = document.getElementById('fileInput');
    if (fileOpenBtn && fileInput) {
        fileOpenBtn.addEventListener('click', () => fileInput.click());
    }

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = btn.dataset.tab;
            if (tab && typeof switchTab === 'function') {
                switchTab(tab, btn);
            }
        });
    });

    // Column selects (header)
    ['originCol', 'destCol', 'weightCol', 'originLatCol', 'originLngCol', 'destLatCol', 'destLngCol'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (typeof handleColumnChange === 'function') handleColumnChange();
        });
    });

    // Ego selects
    document.querySelectorAll('.ego-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const panel = sel.dataset.panel;
            if (panel && typeof updateEgoNetwork === 'function') updateEgoNetwork(parseInt(panel, 10));
        });
    });

    // Toolbar delegation (captures events for dynamically inserted controls)
    const toolbar = document.getElementById('viz-toolbar');
    if (toolbar) {
        // Clicks for buttons with data-action
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const action = btn.dataset.action;
            if (!action) return;

            if (action === 'sankeyZoom') {
                const scale = parseFloat(btn.dataset.scale);
                if (typeof sankeyZoom === 'function') sankeyZoom(scale);
            } else if (action === 'sankeyZoomReset') {
                if (typeof sankeyZoomReset === 'function') sankeyZoomReset();
            } else if (action === 'networkZoom') {
                const factor = parseFloat(btn.dataset.factor);
                if (typeof networkZoom === 'function') networkZoom(factor);
            } else if (action === 'networkZoomReset') {
                if (typeof networkZoomReset === 'function') networkZoomReset();
            }
        });

        // Input/change events for controls
        toolbar.addEventListener('input', (e) => {
            const t = e.target;
            if (!t) return;
            if (t.id === 'sankeyTopN') {
                if (typeof updateSankeyTopN === 'function') updateSankeyTopN(t.value);
            } else if (t.id === 'networkTopN') {
                if (typeof updateNetworkTopN === 'function') updateNetworkTopN(t.value);
            }
        });

        toolbar.addEventListener('change', (e) => {
            const t = e.target;
            if (!t) return;
            if (t.id === 'sankeyOriginFilter' || t.id === 'sankeyDestFilter') {
                if (typeof updateSankeyFilters === 'function') updateSankeyFilters();
            } else if (t.id === 'networkOriginFilter' || t.id === 'networkDestFilter') {
                if (typeof updateNetworkFilters === 'function') updateNetworkFilters();
            }
        });
    }

    // Also add delegation to toolbar-container (same as toolbar)
    const toolbarContainer = document.getElementById('toolbar-container');
    if (toolbarContainer) {
        toolbarContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const action = btn.dataset.action;
            if (!action) return;
            if (action === 'sankeyZoom') {
                const scale = parseFloat(btn.dataset.scale);
                if (typeof sankeyZoom === 'function') sankeyZoom(scale);
            }
        });
    }
});
