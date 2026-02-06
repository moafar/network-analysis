/**
 * APP STATE
 * Centraliza todo el estado de la aplicación.
 */
const appState = {
    file: null,
    fileName: '',
    headers: [],
    rows: [],
    sheet: null,
    originCol: '',
    destCol: '',
    weightCol: '',
    aggregatedEdges: [], // edges ya procesados
    uniqueNodes: new Set(),
    isValid: false,
    outIndex: new Map(), // source -> [edges]
    inIndex: new Map(),  // target -> [edges]
    // Sankey
    sankeyTopN: 50,
    sankeyOriginFilter: '',
    sankeyDestFilter: '',
    // Network
    networkTopN: 100,
    networkOriginFilter: '',
    networkDestFilter: '',
    // cached stats to avoid resetting on tab switch
    sankeyStats: null,
    networkStats: null,
};

/**
 * INICIALIZACIÓN
 */
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);

    // Verificar que librerías están cargadas
    checkLibrariesLoaded();
    
    // Mostrar controles del Sankey por defecto (primera pestaña activa)
    showTabControls('sankey');
});

/**
 * Verificar que las librerías necesarias están disponibles
 */
function checkLibrariesLoaded() {
    const libs = [
        { name: 'XLSX', check: () => typeof XLSX !== 'undefined' },
        { name: 'd3', check: () => typeof d3 !== 'undefined' },
        { name: 'vis', check: () => typeof vis !== 'undefined' }
    ];

    const missing = libs.filter(lib => !lib.check());
    
    if (missing.length > 0) {
        const missingNames = missing.map(m => m.name).join(', ');
        showStatus(
            `⚠ Failed to load libraries: ${missingNames}. Check your internet connection.`,
            'error'
        );
        console.error('Librerías no disponibles:', missingNames);
    } else {
        console.log('✓ Todas las librerías cargadas correctamente');
    }
}

/**
 * MANEJADOR: Seleccionar archivo Excel
 */
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Verificar que XLSX está disponible
    if (typeof XLSX === 'undefined') {
        showStatus('Error: XLSX library not loaded. Please reload the page.', 'error');
        console.error('XLSX is not available');
        return;
    }

    appState.file = file;
    appState.fileName = file.name;
    updateHeader();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Mostrar selección de hoja si hay múltiples
        const sheetNames = workbook.SheetNames;
        if (sheetNames.length > 1) {
            const selectedSheet = prompt(
                `Select the sheet to process:\n${sheetNames.join('\n')}`,
                sheetNames[0]
            );
            if (!selectedSheet || !sheetNames.includes(selectedSheet)) {
                showStatus('Sheet selection cancelled.', 'error');
                return;
            }
            appState.sheet = selectedSheet;
        } else {
            appState.sheet = sheetNames[0];
        }

        // Parsear datos
        parseExcelData(workbook);
        
    } catch (error) {
        console.error('Error al cargar archivo:', error);
        showStatus('Error loading file. Please ensure it is a valid .xlsx.', 'error');
    }
}

/**
 * Parsear datos del Excel
 */
function parseExcelData(workbook) {
    try {
        const worksheet = workbook.Sheets[appState.sheet];
        
        // Leer datos con headers en primera fila
        const data = XLSX.utils.sheet_to_json(worksheet, { 
            defval: ''
        });

        if (!data || data.length === 0) {
            showStatus('File is empty or contains no data.', 'error');
            appState.isValid = false;
            return;
        }

        // Extraer headers desde las claves del primer objeto
        appState.headers = Object.keys(data[0]);
        
        // Rows: los objetos ya son correctos
        appState.rows = data;

        if (appState.headers.length === 0 || appState.rows.length === 0) {
            showStatus('File has no columns or rows.', 'error');
            appState.isValid = false;
            return;
        }

        appState.isValid = true;
        console.log('Headers extraídos:', appState.headers);
        console.log('Número de filas:', appState.rows.length);
        
        showStatus(
            `✓ Loaded: ${appState.rows.length} rows, ${appState.headers.length} columns`,
            'info'
        );

        // Actualizar selects
        populateColumnSelects();
        console.log('Selectores poblados:', appState.headers);
        
    } catch (error) {
        console.error('Error en parseExcelData:', error);
        showStatus('Error processing data.', 'error');
        appState.isValid = false;
    }
}

/**
 * Poblar selects de columnas
 */
function populateColumnSelects() {
    const options = appState.headers.map(h => `<option value="${h}">${h}</option>`).join('');
    
    const originCol = document.getElementById('originCol');
    const destCol = document.getElementById('destCol');
    const weightCol = document.getElementById('weightCol');

    if (originCol) originCol.innerHTML = `<option value="">-- Select --</option>${options}`;
    if (destCol) destCol.innerHTML = `<option value="">-- Select --</option>${options}`;
    if (weightCol) weightCol.innerHTML = `<option value="">-- Automatic (count) --</option>${options}`;

    // Inicializar selects de ego-networks vacíos (se llenarán con valores de la columna destino)
    const egoPlaceholder = `<option value="">-- Select destination --</option>`;
    const ego1 = document.getElementById('ego1Dest');
    const ego2 = document.getElementById('ego2Dest');
    const ego3 = document.getElementById('ego3Dest');
    const ego4 = document.getElementById('ego4Dest');
    
    if (ego1) ego1.innerHTML = egoPlaceholder;
    if (ego2) ego2.innerHTML = egoPlaceholder;
    if (ego3) ego3.innerHTML = egoPlaceholder;
    if (ego4) ego4.innerHTML = egoPlaceholder;

    console.log('✓ Selectores poblados exitosamente');
}

/**
 * MANEJADOR: Cambio en columnas
 */
function handleColumnChange() {
    const originColEl = document.getElementById('originCol');
    const destColEl = document.getElementById('destCol');
    const weightColEl = document.getElementById('weightCol');
    
    if (!originColEl || !destColEl) {
        console.warn('Elementos de selección de columnas no encontrados');
        return;
    }

    const originCol = originColEl.value;
    const destCol = destColEl.value;
    const weightCol = weightColEl ? weightColEl.value : '';

    appState.originCol = originCol;
    appState.destCol = destCol;
    appState.weightCol = weightCol;

    // Siempre intentar poblar los selects de ego con los valores de la columna destino
    populateEgoDestinations();

    // Validar selección mutua
    if (originCol === destCol && originCol !== '') {
        showConfig('⚠ Origin and Destination cannot be the same column.', 'warning');
        appState.originCol = '';
        appState.destCol = '';
        originColEl.value = '';
        destColEl.value = '';
        return;
    }

    // Si ambas columnas están seleccionadas, procesar datos
    if (originCol && destCol) {
        processAggregatedEdges();
        populateSankeyFilters();
        populateNetworkFilters();
        showConfig('✓ Configuration valid. Visualizations will update.', 'info');
        // Renderizar visualizaciones
        renderSankey();
        renderNetwork();
    } else {
        showConfig('Select Origin and Destination to proceed.', 'warning');
    }
}

/**
 * Poblar los selects de las ego-networks con los valores únicos de la columna destino seleccionada
 */
function populateEgoDestinations() {
    const destCol = appState.destCol;
    const egoIds = ['ego1Dest', 'ego2Dest', 'ego3Dest', 'ego4Dest'];

    // Helper para escapar HTML en opciones
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    if (!destCol || !appState.rows || appState.rows.length === 0) {
        // Restaurar placeholder si no hay columna destino
        egoIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<option value="">-- Select destination --</option>`;
        });
        return;
    }

    const vals = new Set();
    appState.rows.forEach(row => {
        const v = String(row[destCol] ?? '').trim();
        if (v) vals.add(v);
    });

    const sorted = Array.from(vals).sort((a,b) => a.localeCompare(b));
    const optionsHtml = `<option value="">-- Select destination --</option>` + sorted.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');

    egoIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = optionsHtml;
    });
}

/**
 * Procesar y agregar links
 */
function processAggregatedEdges() {
    const { originCol, destCol, weightCol, rows } = appState;
    
    const edgesMap = new Map(); // key: "source|target" -> { source, target, value, count }

    rows.forEach(row => {
        const source = String(row[originCol] ?? '').trim();
        const target = String(row[destCol] ?? '').trim();
        
        if (!source || !target) return; // saltar si falta origen o destino

        const key = `${source}|${target}`;
        const weight = weightCol ? parseFloat(row[weightCol]) || 1 : 1;

        if (edgesMap.has(key)) {
            const edge = edgesMap.get(key);
            edge.value += weight;
            edge.count += 1;
        } else {
            edgesMap.set(key, {
                source,
                target,
                value: weight,
                count: 1
            });
        }

        // Registrar nodos únicos
        appState.uniqueNodes.add(source);
        appState.uniqueNodes.add(target);
    });

    appState.aggregatedEdges = Array.from(edgesMap.values());

    // Construir índices para ego-networks
    buildIndices();

    console.log(`Processed ${appState.aggregatedEdges.length} unique edges.`);
    console.log(`${appState.uniqueNodes.size} unique nodes.`);
}

/**
 * Construir índices de nodos para búsquedas rápidas
 */
function buildIndices() {
    appState.outIndex.clear();
    appState.inIndex.clear();

    appState.aggregatedEdges.forEach(edge => {
        // outIndex: source -> [edges]
        if (!appState.outIndex.has(edge.source)) {
            appState.outIndex.set(edge.source, []);
        }
        appState.outIndex.get(edge.source).push(edge);

        // inIndex: target -> [edges]
        if (!appState.inIndex.has(edge.target)) {
            appState.inIndex.set(edge.target, []);
        }
        appState.inIndex.get(edge.target).push(edge);
    });
}

/**
 * UI: Cambiar pestaña activa
 */
function switchTab(tabName, sourceEl) {
    // Desactivar todas las pestañas y botones
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activar pestaña seleccionado
    const pane = document.getElementById(`tab-${tabName}`);
    if (pane) {
        pane.classList.add('active');
    }
    if (sourceEl && sourceEl.classList) sourceEl.classList.add('active');

    // Mostrar controles específicos de la tab
    showTabControls(tabName);

    console.log(`Pestaña cambió a: ${tabName}`);
}

/**
 * Mostrar controles específicos según la tab activa
 */
function showTabControls(tabName) {
    const toolbar = document.getElementById('viz-toolbar');
    if (!toolbar) {
        console.warn('Toolbar no encontrado');
        return;
    }
    
    if (tabName === 'sankey') {
        toolbar.classList.remove('hidden');
        toolbar.innerHTML = `
            <div class="toolbar-group">
                <label for="sankeyTopN">Top-N</label>
                <input type="range" id="sankeyTopN" min="5" max="500" step="5" value="${appState.sankeyTopN}">
                <span id="sankeyTopNVal">${appState.sankeyTopN}</span>
            </div>
            <div class="toolbar-group">
                <label for="sankeyOriginFilter">Origin</label>
                <select id="sankeyOriginFilter"><option value="">All</option></select>
            </div>
            <div class="toolbar-group">
                <label for="sankeyDestFilter">Destination</label>
                <select id="sankeyDestFilter"><option value="">All</option></select>
            </div>
            <div style="display: flex; gap: 4px; align-self: flex-end;">
                <button class="btn" data-action="sankeyZoom" data-scale="1.2">+</button>
                <button class="btn" data-action="sankeyZoom" data-scale="0.8333333333">−</button>
                <button class="btn" data-action="sankeyZoomReset">Reset</button>
            </div>
            <div id="sankeyToolbarStats" class="toolbar-stats">Showing: -- links of --</div>
        `;
        // Re-popular los selects
        populateSankeyFilters();

        // Mostrar estadísticas previas si existen (no reiniciar a "--")
        const sankeyToolbarStatsEl = document.getElementById('sankeyToolbarStats');
        if (sankeyToolbarStatsEl) {
            if (appState.sankeyStats) {
                const s = appState.sankeyStats;
                sankeyToolbarStatsEl.textContent = `Links: ${s.displayedLinks}/${s.totalLinks} · Displayed weight: ${s.displayedWeight.toLocaleString()} / ${s.totalWeight.toLocaleString()}`;
            } else {
                // Mostrar totales generales si no hay estadísticas previas
                const totalLinksInit = appState.aggregatedEdges.length || 0;
                const totalWeightInit = appState.aggregatedEdges.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
                sankeyToolbarStatsEl.textContent = `Links: 0/${totalLinksInit} · Displayed weight: 0 / ${totalWeightInit.toLocaleString()}`;
            }
        }
    } else if (tabName === 'network') {
        toolbar.classList.remove('hidden');
        toolbar.innerHTML = `
            <div class="toolbar-group">
                <label for="networkTopN">Top-N edges</label>
                <input type="range" id="networkTopN" min="5" max="500" step="5" value="${appState.networkTopN || 100}">
                <span id="networkTopNVal">${appState.networkTopN || 100}</span>
            </div>
            <div class="toolbar-group">
                <label for="networkOriginFilter">Origin</label>
                <select id="networkOriginFilter"><option value="">All</option></select>
            </div>
            <div class="toolbar-group">
                <label for="networkDestFilter">Destination</label>
                <select id="networkDestFilter"><option value="">All</option></select>
            </div>
            <div style="display: flex; gap: 4px; align-self: flex-end;">
                <button class="btn" data-action="networkZoom" data-factor="0.8">−</button>
                <button class="btn" data-action="networkZoom" data-factor="1.2">+</button>
                <button class="btn" data-action="networkZoomReset">Reset</button>
            </div>
            <div id="networkToolbarStats" class="toolbar-stats">Showing: -- edges of --</div>
        `;
        populateNetworkFilters();

        // Mostrar estadísticas previas si existen (no reiniciar a "--")
        const networkToolbarStatsEl = document.getElementById('networkToolbarStats');
        if (networkToolbarStatsEl) {
            if (appState.networkStats) {
                const n = appState.networkStats;
                networkToolbarStatsEl.textContent = `Links: ${n.displayedLinks}/${n.totalLinks} · Displayed weight: ${n.displayedWeight.toLocaleString()} / ${n.totalWeight.toLocaleString()}`;
            } else {
                const totalLinksInit = appState.aggregatedEdges.length || 0;
                const totalWeightInit = appState.aggregatedEdges.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
                networkToolbarStatsEl.textContent = `Links: 0/${totalLinksInit} · Displayed weight: 0 / ${totalWeightInit.toLocaleString()}`;
            }
        }
    } else {
        toolbar.classList.add('hidden');
        toolbar.innerHTML = '';
    }
}

/**
 * UI: Actualizar header con nombre de archivo
 */
function updateHeader() {
    const fileName = appState.fileName || '(none)';
    const fileNameEl = document.getElementById('fileName');
    if (fileNameEl) {
        fileNameEl.textContent = `File: ${fileName}`;
    }
}

/**
 * UI: Mostrar mensaje de estado
 */
function showStatus(message, type = 'info') {
    const statusMsg = document.getElementById('statusMsg');
    if (statusMsg) {
        statusMsg.textContent = message;
        statusMsg.className = `alert alert-${type}`;
        statusMsg.classList.remove('hidden');
    }
}

/**
 * UI: Mostrar mensaje de configuración
 */
function showConfig(message, type = 'info') {
    const configMsg = document.getElementById('configMsg');
    if (configMsg) {
        configMsg.textContent = message;
        configMsg.className = `alert alert-${type}`;
        configMsg.classList.remove('hidden');
    }
}

/**
 * Placeholder: Actualizar Ego-Network
 * Se implementará en próximas fases
 */
function updateEgoNetwork(panelId) {
    const sel = document.getElementById(`ego${panelId}Dest`);
    const container = document.getElementById(`ego${panelId}-canvas`);

    if (!container) {
        console.warn('Contenedor ego no encontrado para panel', panelId);
        return;
    }

    // Placeholder when no selection
    if (!sel || !sel.value) {
        container.innerHTML = '<div class="tab-placeholder">Select a destination to show the ego-network.</div>';
        // destroy previous instance if any
        if (window.egoNetworkInstances && window.egoNetworkInstances[panelId]) {
            try { window.egoNetworkInstances[panelId].destroy(); } catch(e){}
            delete window.egoNetworkInstances[panelId];
        }
        return;
    }

    const egoName = sel.value;

    if (!appState.isValid || !appState.aggregatedEdges || appState.aggregatedEdges.length === 0) {
        container.innerHTML = '<div class="tab-placeholder">No data available to generate the ego-network.</div>';
        return;
    }

    // Recolectar aristas relacionadas con el ego (entrantes y salientes)
    const outEdges = appState.outIndex.get(egoName) || [];
    const inEdges = appState.inIndex.get(egoName) || [];

    const neighbors = new Set();
    outEdges.forEach(e => neighbors.add(e.target));
    inEdges.forEach(e => neighbors.add(e.source));
    neighbors.add(egoName);

    // Construir nodos y calcular tamaño por suma de pesos relacionados
    const nodeList = Array.from(neighbors);
    const idMap = {};
    nodeList.forEach((n, i) => idMap[n] = i);

    // Calcular peso total por nodo (suma de valores de aristas que involucran al nodo, dentro del subgrafo)
    const weightByNode = {};
    nodeList.forEach(n => weightByNode[n] = 0);

    // Aristas a mostrar: las que tienen al menos un extremo en el conjunto (preferimos mostrar conexiones con el ego)
    const edgesToShow = [];
    // Preferir mostrar edges conectados al ego
    outEdges.forEach(e => {
        edgesToShow.push(e);
        weightByNode[e.source] += Number(e.value) || 0;
        weightByNode[e.target] += Number(e.value) || 0;
    });
    inEdges.forEach(e => {
        // evitar duplicados
        if (!edgesToShow.some(x => x.source === e.source && x.target === e.target)) {
            edgesToShow.push(e);
            weightByNode[e.source] += Number(e.value) || 0;
            weightByNode[e.target] += Number(e.value) || 0;
        }
    });

    // Opcional: incluir aristas entre vecinos para contexto (si existen)
    appState.aggregatedEdges.forEach(e => {
        if (neighbors.has(e.source) && neighbors.has(e.target)) {
            // ya incluidas las que tocan al ego; evitar duplicados
            if (!edgesToShow.some(x => x.source === e.source && x.target === e.target)) {
                edgesToShow.push(e);
                weightByNode[e.source] += Number(e.value) || 0;
                weightByNode[e.target] += Number(e.value) || 0;
            }
        }
    });

    // Calcular estadísticas del subgrafo mostrado
    const neighborCount = Math.max(0, neighbors.size - 1);
    const edgesCount = edgesToShow.length;
    const totalDisplayedWeight = edgesToShow.reduce((s, it) => s + (Number(it.value) || 0), 0);

    // Actualizar UI del panel con estadísticas
    const statsEl = document.getElementById(`ego${panelId}Stats`);
    if (statsEl) {
        // Show English labels: Edges / Referrals / Neighbors
        if (neighborCount === edgesCount) {
            statsEl.textContent = `Edges: ${edgesCount} · Referrals: ${totalDisplayedWeight.toLocaleString()}`;
        } else {
            statsEl.textContent = `Neighbors: ${neighborCount} · Edges: ${edgesCount} · Referrals: ${totalDisplayedWeight.toLocaleString()}`;
        }
    }

    // Construir arrays para vis-network
    const nodesArray = nodeList.map((name, idx) => {
        const totalWeight = weightByNode[name] || 0;
        const size = 15 + Math.min(85, Math.round(totalWeight));
        return {
            id: idx,
            label: name,
            title: `${name}\nReferrals: ${totalWeight.toLocaleString()}`,
            value: totalWeight,
            size: size,
            shape: 'dot'
        };
    });

    const edgesArray = edgesToShow.map((e, idx) => ({
        id: `ego-${panelId}-${idx}`,
        from: idMap[e.source],
        to: idMap[e.target],
        value: e.value,
        title: `${e.source} → ${e.target}\nReferrals: ${Number(e.value).toLocaleString()}`,
        width: Math.max(1, Math.min(6, (Number(e.value) || 0) / 1)),
        arrows: { to: { enabled: true, scaleFactor: 0.5 } }
    }));

    // Limpiar contenedor
    container.innerHTML = '';

    // Crear instancia vis-network (guardar referencias por panel)
    const data = { nodes: new vis.DataSet(nodesArray), edges: new vis.DataSet(edgesArray) };
    const options = {
        physics: {
            enabled: true,
            solver: 'barnesHut',
            barnesHut: {
                avoidOverlap: 0,
                centralGravity: 0.25,
                damping: 0.45,
                gravitationalConstant: -2800,
                springConstant: 0.02,
                springLength: 150
            },
            stabilization: {
                enabled: true,
                fit: true,
                iterations: 1000,
                onlyDynamicEdges: false,
                updateInterval: 50
            }
        },
        interaction: {
            dragNodes: true,
            hideEdgesOnDrag: false,
            hideNodesOnDrag: false,
            hover: true,
            zoomView: true,
            dragView: true,
            multiselect: false
        },
        nodes: { physics: true, scaling: { min: 10, max: 60 } },
        edges: { smooth: { enabled: true, type: 'dynamic' } },
        layout: { improvedLayout: true }
    };

    // destruir instancia previa si existe
    if (!window.egoNetworkInstances) window.egoNetworkInstances = {};
    if (window.egoNetworkInstances[panelId]) {
        try { window.egoNetworkInstances[panelId].destroy(); } catch(e){}
        delete window.egoNetworkInstances[panelId];
    }

    try {
        const net = new vis.Network(container, data, options);
        // bandera para evitar que subsequent 'stabilized' events vuelvan a centrar la red
        net._egoInitialFitDone = false;
        window.egoNetworkInstances[panelId] = net;

        // Al terminar la estabilización, desactivar física para evitar vibraciones
        net.once('stabilizationIterationsDone', () => {
            try {
                net.setOptions({ physics: { enabled: false } });
            } catch (e) {}
            try { net.fit(); } catch (e) {}
            net._egoInitialFitDone = true;
        });

        // También ajustar zoom/fit cuando la red esté establecida
        net.on('stabilized', () => {
            try {
                if (!net._egoInitialFitDone) {
                    try { net.fit(); } catch (e) {}
                    net._egoInitialFitDone = true;
                }
            } catch (e) {}
        });

        // Al arrastrar, habilitar física temporalmente y aplicar un pequeño nudge a vecinos
        if (!window._egoPhysicsTimeouts) window._egoPhysicsTimeouts = {};

        net.on('dragStart', (params) => {
            try {
                // Si un nodo se está arrastrando, asegurarnos que no esté fijado
                const dragged = params && params.nodes && params.nodes[0];
                if (typeof dragged !== 'undefined' && dragged !== null) {
                    try { data.nodes.update({ id: dragged, fixed: { x: false, y: false } }); } catch(e){}
                }
                // habilitar física para permitir movimiento ligero
                net.setOptions({ physics: { enabled: true } });
            } catch (e) {}

            // aplicar nudge a nodos conectados
            try {
                const dragged = params && params.nodes && params.nodes[0];
                if (typeof dragged !== 'undefined' && dragged !== null) {
                    const connected = net.getConnectedNodes(dragged) || [];
                    if (connected.length > 0) {
                        const ids = [dragged].concat(connected);
                        const positions = net.getPositions(ids);
                        const posDragged = positions[dragged];
                        const nudgePx = 12;
                        if (posDragged) {
                            connected.forEach(nei => {
                                const posNei = positions[nei];
                                if (!posNei) return;
                                let dx = posNei.x - posDragged.x;
                                let dy = posNei.y - posDragged.y;
                                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                                const nx = dx / dist;
                                const ny = dy / dist;
                                const newX = posNei.x + nx * nudgePx;
                                const newY = posNei.y + ny * nudgePx;
                                try { net.moveNode(nei, newX, newY); } catch (e) {}
                            });
                        }
                    }
                }
            } catch (e) {}

            // clear pending disable timeout
            if (window._egoPhysicsTimeouts[panelId]) {
                clearTimeout(window._egoPhysicsTimeouts[panelId]);
                delete window._egoPhysicsTimeouts[panelId];
            }
        });

        net.on('dragEnd', (params) => {
            try {
                // Al soltar, permitir que la física asiente la red durante un corto periodo
                // Primero limpiamos timeouts previos
                if (window._egoPhysicsTimeouts[panelId]) {
                    clearTimeout(window._egoPhysicsTimeouts[panelId]);
                    delete window._egoPhysicsTimeouts[panelId];
                }

                // Activar física con parámetros similares al archivo de referencia
                try {
                    net.setOptions({
                        physics: {
                            enabled: true,
                            barnesHut: {
                                avoidOverlap: 0,
                                centralGravity: 0.25,
                                damping: 0.45,
                                gravitationalConstant: -2800,
                                springConstant: 0.02,
                                springLength: 150
                            }
                        }
                    });
                    try { net.startSimulation(); } catch (e) {}
                } catch (e) {}

                // Esperar un tiempo para que la red se asiente y luego desactivar física
                window._egoPhysicsTimeouts[panelId] = setTimeout(() => {
                    try {
                        // No fijamos posiciones: guardamos la disposición que la física dejó
                        // y simplemente desactivamos la física para detener movimientos.
                        try { net.setOptions({ physics: { enabled: false } }); } catch (e) {}
                        try { net.stopSimulation(); } catch (e) {}
                    } catch (err) {
                        // silencioso
                    } finally {
                        if (window._egoPhysicsTimeouts[panelId]) {
                            clearTimeout(window._egoPhysicsTimeouts[panelId]);
                            delete window._egoPhysicsTimeouts[panelId];
                        }
                    }
                }, 1200);
            } catch (e) {}
        });

    } catch (err) {
        console.error('Error creando ego-network:', err);
        container.innerHTML = '<div class="tab-placeholder">Error al renderizar la ego-network.</div>';
    }
}

/**
 * Placeholder: Actualizar Network Top-N
 */
function updateNetworkTopN(value) {
    appState.networkTopN = parseInt(value, 10);
    console.log(`Network Top-N actualizado a: ${value}`);
}

/**
 * ========== SANKEY ==========
 */

let sankeyState = {
    zoomTransform: d3.zoomIdentity,
    svgElement: null,
    zoomBehavior: null,
};

/**
 * Actualizar Top-N del Sankey en tiempo real
 */
function updateSankeyTopN(value) {
    appState.sankeyTopN = parseInt(value, 10);
    const topNVal = document.getElementById('sankeyTopNVal');
    if (topNVal) {
        topNVal.textContent = value;
    }
    renderSankey();
}

/**
 * Actualizar filtros de Sankey
 */
function updateSankeyFilters() {
    const originFilter = document.getElementById('sankeyOriginFilter');
    const destFilter = document.getElementById('sankeyDestFilter');
    if (originFilter) {
        appState.sankeyOriginFilter = originFilter.value;
    }
    if (destFilter) {
        appState.sankeyDestFilter = destFilter.value;
    }
    renderSankey();
}

/**
 * Zoom in/out/reset
 */
function sankeyZoom(scale) {
    if (!sankeyState.svgElement || !sankeyState.zoomBehavior) return;
    d3.select(sankeyState.svgElement)
        .transition()
        .duration(200)
        .call(sankeyState.zoomBehavior.scaleBy, scale);
}

function sankeyZoomReset() {
    if (!sankeyState.svgElement || !sankeyState.zoomBehavior) return;
    sankeyState.zoomTransform = d3.zoomIdentity;
    d3.select(sankeyState.svgElement)
        .transition()
        .duration(250)
        .call(sankeyState.zoomBehavior.transform, sankeyState.zoomTransform);
}

/**
 * Poblar selects de filtro con valores únicos
 */
function populateSankeyFilters() {
    const origins = new Set();
    const dests = new Set();

    appState.aggregatedEdges.forEach(edge => {
        origins.add(edge.source);
        dests.add(edge.target);
    });

    const originsArray = Array.from(origins).sort();
    const destsArray = Array.from(dests).sort();

    // Poblar origen
    const originSelect = document.getElementById('sankeyOriginFilter');
    if (originSelect) {
        const originValue = originSelect.value;
        originSelect.innerHTML = '<option value="">All</option>';
        originsArray.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o;
            opt.textContent = o;
            originSelect.appendChild(opt);
        });
        originSelect.value = originValue;
    }

    // Poblar destino
    const destSelect = document.getElementById('sankeyDestFilter');
    if (destSelect) {
        const destValue = destSelect.value;
        destSelect.innerHTML = '<option value="">All</option>';
        destsArray.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            destSelect.appendChild(opt);
        });
        destSelect.value = destValue;
    }
}

/**
 * Actualizar Top-N de la Red Gravitacional en tiempo real
 */
function updateNetworkTopN(value) {
    appState.networkTopN = parseInt(value, 10);
    const topNVal = document.getElementById('networkTopNVal');
    if (topNVal) {
        topNVal.textContent = value;
    }
    renderNetwork();
}

/**
 * Actualizar filtros de la Red Gravitacional
 */
function updateNetworkFilters() {
    const originFilter = document.getElementById('networkOriginFilter');
    const destFilter = document.getElementById('networkDestFilter');
    if (originFilter) {
        appState.networkOriginFilter = originFilter.value;
    }
    if (destFilter) {
        appState.networkDestFilter = destFilter.value;
    }
    renderNetwork();
}

/**
 * Zoom de la Red Gravitacional
 */
function networkZoom(factor) {
    if (!window.networkInstance) return;
    const currentZoom = window.networkInstance.getScale();
    window.networkInstance.setOptions({ physics: false });
    window.networkInstance.moveTo({ scale: currentZoom * factor });
}

function networkZoomReset() {
    if (!window.networkInstance) return;
    window.networkInstance.fit();
}

/**
 * Poblar selects de filtro para Red Gravitacional
 */
function populateNetworkFilters() {
    const origins = new Set();
    const dests = new Set();

    appState.aggregatedEdges.forEach(edge => {
        origins.add(edge.source);
        dests.add(edge.target);
    });

    const originsArray = Array.from(origins).sort();
    const destsArray = Array.from(dests).sort();

    // Poblar origen
    const originSelect = document.getElementById('networkOriginFilter');
    const originValue = originSelect ? originSelect.value : '';
    if (originSelect) {
        originSelect.innerHTML = '<option value="">All</option>';
        originsArray.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o;
            opt.textContent = o;
            originSelect.appendChild(opt);
        });
        originSelect.value = originValue;
    }

    // Poblar destino
    const destSelect = document.getElementById('networkDestFilter');
    const destValue = destSelect ? destSelect.value : '';
    if (destSelect) {
        destSelect.innerHTML = '<option value="">All</option>';
        destsArray.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            destSelect.appendChild(opt);
        });
        destSelect.value = destValue;
    }
}

/**
 * Renderizar Sankey con D3 y Zoom
 */
function renderSankey() {
    if (!appState.isValid || appState.aggregatedEdges.length === 0) {
        console.warn('No hay datos para renderizar Sankey');
        return;
    }

    // Calcular estadísticas globales y mostrar resumen inicial
    const statsEl = document.getElementById('sankeyStats');
    const toolbarStatsEl = document.getElementById('sankeyToolbarStats');
    const totalLinks = appState.aggregatedEdges.length;
    const totalWeight = appState.aggregatedEdges.reduce((s, e) => s + (Number(e.value) || 0), 0);
    if (statsEl) {
        statsEl.textContent = `Links: ${totalLinks} · Total weight: ${totalWeight.toLocaleString()}`;
    }
    if (toolbarStatsEl) {
        toolbarStatsEl.textContent = `Links: -- / ${totalLinks} · Displayed weight: -- / ${totalWeight.toLocaleString()}`;
    }

    // Filtrar edges según Top-N y filtros
    let filteredEdges = appState.aggregatedEdges.slice();

    // Aplicar filtros
    if (appState.sankeyOriginFilter) {
        filteredEdges = filteredEdges.filter(e => e.source === appState.sankeyOriginFilter);
    }
    if (appState.sankeyDestFilter) {
        filteredEdges = filteredEdges.filter(e => e.target === appState.sankeyDestFilter);
    }

    // Ordenar y tomar Top-N
    filteredEdges.sort((a, b) => b.value - a.value);
    const topN = appState.sankeyTopN || 50;
    const displayedEdges = filteredEdges.slice(0, topN);

    // Estadísticas detalladas: enlaces mostrados y suma de pesos
    const displayedLinks = displayedEdges.length;
    const displayedWeight = displayedEdges.reduce((s, e) => s + (Number(e.value) || 0), 0);
    // Guardar estadísticas en el estado para mostrarlas al cambiar de pestaña
    appState.sankeyStats = {
        totalLinks,
        totalWeight,
        displayedLinks,
        displayedWeight
    };

    if (statsEl) {
        statsEl.textContent = `Displayed links: ${displayedLinks}/${totalLinks} · Displayed weight: ${displayedWeight.toLocaleString()} / ${totalWeight.toLocaleString()}`;
    }
    if (toolbarStatsEl) {
        toolbarStatsEl.textContent = `Links: ${displayedLinks}/${totalLinks} · Displayed weight: ${displayedWeight.toLocaleString()} / ${totalWeight.toLocaleString()}`;
    }

    // Extraer nodos
    const nodeSet = new Set();
    displayedEdges.forEach(edge => {
        nodeSet.add(edge.source);
        nodeSet.add(edge.target);
    });
    const nodes = Array.from(nodeSet).map(name => ({ name }));

    // Limpiar
    const container = document.getElementById('sankey-container');
    container.innerHTML = '';

    // Si no hay datos
    if (nodes.length === 0) {
        container.innerHTML = '<div class="tab-placeholder">No hay flujos que mostrar con los filtros aplicados.</div>';
        return;
    }

    // Dimensiones responsivas
    const width = container.clientWidth || 1200;
    const height = container.clientHeight || 800;

    // Crear SVG con viewBox para zoom
    const svg = d3.create('svg')
        .attr('viewBox', [0, 0, width, height])
        .attr('width', width)
        .attr('height', height)
        .style('display', 'block')
        .style('cursor', 'grab')
        .style('background', 'white');

    const gZoom = svg.append('g');

    // Sankey layout
    const sankey = d3.sankey()
        .nodeId(d => d.name)
        .nodeWidth(15)
        .nodePadding(20)
        .extent([[1, 1], [width - 1, height - 1]]);

    const { nodes: sinkNodes, links: sinkLinks } = sankey({
        nodes: nodes.map(d => ({ ...d })),
        links: displayedEdges.map(d => ({
            source: d.source,
            target: d.target,
            value: d.value
        }))
    });

    // Colormap
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Estado de selección
    let selectedNode = null;

    // Dibujar links
    const links = gZoom.append('g')
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round')
        .selectAll('path')
        .data(sinkLinks)
        .join('path')
            .attr('class', 'sankey-link')
            .attr('d', d3.sankeyLinkHorizontal())
            .attr('stroke', d => colorScale(d.target.name))
            .attr('stroke-width', d => Math.max(1, d.width))
            .attr('stroke-opacity', 0.55);
    
    links.append('title')
        .text(d => `${d.source.name} → ${d.target.name}\n${d.value.toLocaleString()} referrals`);

    // Dibujar nodos
    const node = gZoom.append('g')
        .selectAll('rect')
        .data(sinkNodes)
        .join('rect')
            .attr('x', d => d.x0)
            .attr('y', d => d.y0)
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => Math.max(1, d.y1 - d.y0))
            .attr('fill', d => colorScale(d.name))
            .attr('stroke', 'rgba(0,0,0,0.25)')
            .style('cursor', 'pointer');

    node.append('title')
        .text(d => `${d.name}\n${d.value.toLocaleString()} flujos`);

    // Etiquetas
    const labels = gZoom.append('g')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10)
        .selectAll('text')
        .data(sinkNodes)
        .join('text')
            .attr('x', d => (d.x0 < width / 2) ? d.x1 + 6 : d.x0 - 6)
            .attr('y', d => (d.y0 + d.y1) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => (d.x0 < width / 2) ? 'start' : 'end')
            .attr('font-size', '11px')
            .text(d => d.name)
            .style('cursor', 'pointer');

    // Función común para manejar selección de nodo
    const handleNodeClick = function(event, d) {
        event.stopPropagation();
        
        // Si ya está seleccionado, deseleccionar
        if (selectedNode === d.name) {
            selectedNode = null;
            links.transition().duration(300)
                .attr('stroke-opacity', 0.55);
            node.transition().duration(300)
                .attr('opacity', 1);
            labels.transition().duration(300)
                .attr('opacity', 1);
        } else {
            // Seleccionar nuevo nodo
            selectedNode = d.name;
            
            // Filtrar enlaces
            links.transition().duration(300)
                .attr('stroke-opacity', link => {
                    if (link.source.name === selectedNode || link.target.name === selectedNode) {
                        return 0.8;
                    } else {
                        return 0.08;
                    }
                });
            
            // Difuminar nodos no conectados
            node.transition().duration(300)
                .attr('opacity', n => {
                    if (n.name === selectedNode) return 1;
                    const isConnected = sinkLinks.some(link => 
                        (link.source.name === selectedNode && link.target.name === n.name) ||
                        (link.target.name === selectedNode && link.source.name === n.name)
                    );
                    return isConnected ? 1 : 0.2;
                });
            
            // Difuminar etiquetas no conectadas
            labels.transition().duration(300)
                .attr('opacity', n => {
                    if (n.name === selectedNode) return 1;
                    const isConnected = sinkLinks.some(link => 
                        (link.source.name === selectedNode && link.target.name === n.name) ||
                        (link.target.name === selectedNode && link.source.name === n.name)
                    );
                    return isConnected ? 1 : 0.3;
                });
        }
    };

    // Agregar evento de click a nodos y etiquetas
    node.on('click', handleNodeClick);
    labels.on('click', handleNodeClick);

    // Zoom behavior - configurado para no interferir con clicks
    const zoom = d3.zoom()
        .scaleExtent([0.5, 8])
        .filter(function(event) {
            // Permitir wheel para zoom, prevenir drag en nodos y etiquetas
            if (event.type === 'wheel') return true;
            if (event.type === 'mousedown') {
                // Verificar si el click es en un nodo o etiqueta
                const target = event.target;
                if (target.tagName === 'rect' || target.tagName === 'text') return false;
            }
            return !event.button;
        })
        .on('zoom', (event) => {
            sankeyState.zoomTransform = event.transform;
            gZoom.attr('transform', sankeyState.zoomTransform);
        });

    svg.call(zoom);
    svg.call(zoom.transform, sankeyState.zoomTransform);

    // Click en el SVG para deseleccionar
    svg.on('click', function(event) {
        // Solo si no clickeamos un nodo o etiqueta
        if (event.target.tagName !== 'rect' && event.target.tagName !== 'text' && selectedNode !== null) {
            selectedNode = null;
            links.transition().duration(300)
                .attr('stroke-opacity', 0.55);
            node.transition().duration(300)
                .attr('opacity', 1);
            labels.transition().duration(300)
                .attr('opacity', 1);
        }
    });

    svg.on('mousedown', function(event) {
        if (event.target.tagName !== 'rect' && event.target.tagName !== 'text') {
            svg.style('cursor', 'grabbing');
        }
    });
    svg.on('mouseup', () => svg.style('cursor', 'grab'));
    svg.on('mouseleave', () => svg.style('cursor', 'grab'));

    // Guardar referencias para zoom buttons
    sankeyState.svgElement = svg.node();
    sankeyState.zoomBehavior = zoom;

    // Montar SVG
    container.appendChild(svg.node());

    console.log(`Sankey renderizado: ${nodes.length} nodos, ${displayedEdges.length} flujos`);
}
/**
 * Renderizar Red Gravitacional con vis-network
 */
function renderNetwork() {
    if (!appState.isValid || appState.aggregatedEdges.length === 0) {
        console.warn('No hay datos para renderizar Red Gravitacional');
        return;
    }

    const container = document.getElementById('network-container');
    if (!container) {
        console.error('No se encontró el contenedor network-container');
        return;
    }

    // Filtrar edges según Top-N y filtros
    let filteredEdges = appState.aggregatedEdges.slice();

    // Aplicar filtros
    if (appState.networkOriginFilter) {
        filteredEdges = filteredEdges.filter(e => e.source === appState.networkOriginFilter);
    }
    if (appState.networkDestFilter) {
        filteredEdges = filteredEdges.filter(e => e.target === appState.networkDestFilter);
    }

    // Ordenar y tomar Top-N
    filteredEdges.sort((a, b) => b.value - a.value);
    const topN = appState.networkTopN || 100;
    const displayedEdges = filteredEdges.slice(0, topN);

    // Actualizar stats
    const statsEl = document.getElementById('networkStats');
    if (statsEl) {
        // Calcular estadísticas para la red
        const totalLinksN = appState.aggregatedEdges.length;
        const totalWeightN = appState.aggregatedEdges.reduce((s, e) => s + (Number(e.value) || 0), 0);
        const displayedLinksN = displayedEdges.length;
        const displayedWeightN = displayedEdges.reduce((s, e) => s + (Number(e.value) || 0), 0);

        // Guardar en el estado para que no se reinicialice al cambiar de pestaña
        appState.networkStats = {
            totalLinks: totalLinksN,
            totalWeight: totalWeightN,
            displayedLinks: displayedLinksN,
            displayedWeight: displayedWeightN
        };

        statsEl.textContent = `Displayed links: ${displayedLinksN}/${totalLinksN} · Displayed weight: ${displayedWeightN.toLocaleString()} / ${totalWeightN.toLocaleString()}`;
        const toolbarNet = document.getElementById('networkToolbarStats');
        if (toolbarNet) {
            toolbarNet.textContent = `Links: ${displayedLinksN}/${totalLinksN} · Displayed weight: ${displayedWeightN.toLocaleString()} / ${totalWeightN.toLocaleString()}`;
        }
    }

    // Construir nodos y calcular grados (suma de derivaciones in + out)
    const nodeMap = {};        // nombre -> id numérico
    const nodeMap_reverse = {};  // id numérico -> nombre
    const nodeSet = new Set();
    const degree = {};         // id -> suma de derivaciones

    displayedEdges.forEach(edge => {
        nodeSet.add(edge.source);
        nodeSet.add(edge.target);
    });

    // Mapear nombres a IDs y calcular grados
    let nodeId = 0;
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    nodeSet.forEach(nodeName => {
        nodeMap[nodeName] = nodeId;
        nodeMap_reverse[nodeId] = nodeName;
        degree[nodeId] = 0;
        nodeId++;
    });

    // Sumar los valores de derivaciones para cada nodo
    displayedEdges.forEach(edge => {
        const fromId = nodeMap[edge.source];
        const toId = nodeMap[edge.target];
        degree[fromId] += edge.value;  // Derivaciones salientes
        degree[toId] += edge.value;    // Derivaciones entrantes
    });

    // Encontrar min/max para escalado de nodos
    const degreeValues = Object.values(degree).filter(d => d > 0);
    const minDegree = Math.min(...degreeValues);
    const maxDegree = Math.max(...degreeValues);
    const degreeDelta = maxDegree - minDegree || 1;

    // Crear array de nodos para vis-network
    const nodesArray = [];
    const nodeColors = {};

    nodeSet.forEach((nodeName, idx) => {
        const numId = nodeMap[nodeName];
        const totalDerivations = degree[numId] || 0;
        
        // Escalar tamaño de 15 a 100 basado en derivaciones totales
        const size = 15 + ((totalDerivations - minDegree) / degreeDelta) * 85;
        const color = colorScale(nodeName);
        
        nodeColors[numId] = color;
        
        nodesArray.push({
            id: numId,
            label: nodeName,
            title: `${nodeName} - Referrals: ${totalDerivations.toLocaleString()}`,
            size: size,
            color: {
                background: color,
                border: color,
                highlight: { background: color, border: color }
            },
            shape: 'dot'
        });
    });

    // Encontrar min/max para grosor de aristas
    const edgeValues = displayedEdges.map(e => e.value);
    const minEdgeValue = Math.min(...edgeValues);
    const maxEdgeValue = Math.max(...edgeValues);
    const edgeDelta = maxEdgeValue - minEdgeValue || 1;

    // Crear array de aristas para vis-network
    const edgesArray = [];
    displayedEdges.forEach((edge, idx) => {
        // Escalar grosor de 0.5 a 5
        const width = 0.5 + ((edge.value - minEdgeValue) / edgeDelta) * 4.5;
        
        const fromId = nodeMap[edge.source];
        const toId = nodeMap[edge.target];
        const edgeColor = nodeColors[fromId] || '#cccccc';
        
        edgesArray.push({
            id: idx,
            from: fromId,
            to: toId,
            value: edge.value,
            width: width,
            title: `${edge.source} → ${edge.target}<br/>Referrals: ${edge.value.toLocaleString()}`,
            arrows: 'to',
            color: {
                color: edgeColor,
                highlight: edgeColor,
                opacity: 0.6
            },
            smooth: {
                type: 'continuous'
            }
        });
    });

    console.log(`Red Gravitacional: ${nodesArray.length} nodos, ${edgesArray.length} aristas`);

    // Crear instancia vis-network
    const data = {
        nodes: new vis.DataSet(nodesArray),
        edges: new vis.DataSet(edgesArray)
    };

    const options = {
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -8000,
                centralGravity: 0.5,
                springLength: 250,
                springConstant: 0.02,
                damping: 0.95,
                avoidOverlap: 0.2
            },
            stabilization: {
                enabled: true,
                iterations: 200,
                fit: true,
                updateInterval: 50
            }
        },
        interaction: {
            zoomView: true,
            dragView: true,
            navigationButtons: false,
            keyboard: true,
            hideEdgesOnDrag: false
        },
        layout: {
            randomSeed: 42
        },
        edges: {
            smooth: {
                enabled: true,
                type: 'continuous'
            }
        }
    };

    // Limpiar contenedor y crear nueva instancia
    container.innerHTML = '';
    window.networkInstance = new vis.Network(container, data, options);
    
    // Variables para control de selección
    let highlightActive = false;
    const allNodes = data.nodes;
    const allEdges = data.edges;

    // Función de resaltado de vecindario
    const neighbourhoodHighlight = (params) => {
        let allNodesObj = allNodes.get({ returnType: "Object" });

        if (params.nodes.length > 0) {
            highlightActive = true;
            const selectedNode = params.nodes[0];
            const connectedNodes = window.networkInstance.getConnectedNodes(selectedNode);

            // Difuminar todos los nodos
            for (let nodeId in allNodesObj) {
                allNodesObj[nodeId].color = "rgba(200,200,200,0.5)";
                if (allNodesObj[nodeId].hiddenLabel === undefined) {
                    allNodesObj[nodeId].hiddenLabel = allNodesObj[nodeId].label;
                    allNodesObj[nodeId].label = undefined;
                }
            }

            // Restaurar color de nodos conectados
            for (let i = 0; i < connectedNodes.length; i++) {
                allNodesObj[connectedNodes[i]].color = nodeColors[connectedNodes[i]] || "rgba(150,150,150,0.75)";
                if (allNodesObj[connectedNodes[i]].hiddenLabel !== undefined) {
                    allNodesObj[connectedNodes[i]].label = allNodesObj[connectedNodes[i]].hiddenLabel;
                    allNodesObj[connectedNodes[i]].hiddenLabel = undefined;
                }
            }

            // Restaurar color del nodo seleccionado
            allNodesObj[selectedNode].color = nodeColors[selectedNode];
            if (allNodesObj[selectedNode].hiddenLabel !== undefined) {
                allNodesObj[selectedNode].label = allNodesObj[selectedNode].hiddenLabel;
                allNodesObj[selectedNode].hiddenLabel = undefined;
            }

            // Actualizar nodos
            const updateArray = [];
            for (let nodeId in allNodesObj) {
                updateArray.push(allNodesObj[nodeId]);
            }
            allNodes.update(updateArray);

        } else if (highlightActive === true) {
            // Restaurar todos los nodos
            for (let nodeId in allNodesObj) {
                allNodesObj[nodeId].color = nodeColors[nodeId];
                if (allNodesObj[nodeId].hiddenLabel !== undefined) {
                    allNodesObj[nodeId].label = allNodesObj[nodeId].hiddenLabel;
                    allNodesObj[nodeId].hiddenLabel = undefined;
                }
            }

            const updateArray = [];
            for (let nodeId in allNodesObj) {
                updateArray.push(allNodesObj[nodeId]);
            }
            allNodes.update(updateArray);

            highlightActive = false;
        }
    };

    // Event listener para selección de nodo
    window.networkInstance.on('select', (params) => {
        neighbourhoodHighlight(params);
    });

    window.networkInstance.on('deselectNode', () => {
        neighbourhoodHighlight({ nodes: [] });
    });

    console.log('Red Gravitacional renderizada correctamente');
}