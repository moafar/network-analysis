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
            `⚠ No se pudieron cargar las librerías: ${missingNames}. Verifica tu conexión a internet.`,
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
        showStatus('Error: Librería XLSX no está cargada. Recarga la página.', 'error');
        console.error('XLSX no está disponible');
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
                `Selecciona la hoja a procesar:\n${sheetNames.join('\n')}`,
                sheetNames[0]
            );
            if (!selectedSheet || !sheetNames.includes(selectedSheet)) {
                showStatus('Selección de hoja cancelada.', 'error');
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
        showStatus('Error al cargar el archivo. Verifica que sea un .xlsx válido.', 'error');
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
            showStatus('Archivo vacío o sin datos.', 'error');
            appState.isValid = false;
            return;
        }

        // Extraer headers desde las claves del primer objeto
        appState.headers = Object.keys(data[0]);
        
        // Rows: los objetos ya son correctos
        appState.rows = data;

        if (appState.headers.length === 0 || appState.rows.length === 0) {
            showStatus('Archivo sin columnas o sin filas de datos.', 'error');
            appState.isValid = false;
            return;
        }

        appState.isValid = true;
        console.log('Headers extraídos:', appState.headers);
        console.log('Número de filas:', appState.rows.length);
        
        showStatus(
            `✓ Cargado: ${appState.rows.length} filas, ${appState.headers.length} columnas`,
            'info'
        );

        // Actualizar selects
        populateColumnSelects();
        console.log('Selectores poblados:', appState.headers);
        
    } catch (error) {
        console.error('Error en parseExcelData:', error);
        showStatus('Error al procesar datos.', 'error');
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

    if (originCol) originCol.innerHTML = `<option value="">-- Selecciona --</option>${options}`;
    if (destCol) destCol.innerHTML = `<option value="">-- Selecciona --</option>${options}`;
    if (weightCol) weightCol.innerHTML = `<option value="">-- Automático (conteo) --</option>${options}`;

    // Poblar selects de ego-networks (destinos)
    const destOptions = `<option value="">-- Selecciona destino --</option>${options}`;
    const ego1 = document.getElementById('ego1Dest');
    const ego2 = document.getElementById('ego2Dest');
    const ego3 = document.getElementById('ego3Dest');
    const ego4 = document.getElementById('ego4Dest');
    
    if (ego1) ego1.innerHTML = destOptions;
    if (ego2) ego2.innerHTML = destOptions;
    if (ego3) ego3.innerHTML = destOptions;
    if (ego4) ego4.innerHTML = destOptions;

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

    // Validar selección mutua
    if (originCol === destCol && originCol !== '') {
        showConfig('⚠ Origen y Destino no pueden ser la misma columna.', 'warning');
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
        showConfig('✓ Configuración válida. Las visualizaciones se actualizarán.', 'info');
        // Renderizar visualizaciones
        renderSankey();
        renderNetwork();
    } else {
        showConfig('Selecciona Origen y Destino para proceder.', 'warning');
    }
}

/**
 * Procesar y agregar edges
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

    console.log(`Procesadas ${appState.aggregatedEdges.length} aristas únicas.`);
    console.log(`${appState.uniqueNodes.size} nodos únicos.`);
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
function switchTab(tabName) {
    // Desactivar todas las pestañas y botones
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activar pestaña y botón seleccionado
    const pane = document.getElementById(`tab-${tabName}`);
    if (pane) {
        pane.classList.add('active');
    }
    event.target.classList.add('active');

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
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="sankeyTopN" style="font-size: 11px; color: #666;">Top-N</label>
                <input type="range" id="sankeyTopN" min="5" max="500" step="5" value="${appState.sankeyTopN}" 
                       style="width: 120px; height: 6px;"
                       oninput="updateSankeyTopN(this.value)">
                <span id="sankeyTopNVal" style="font-size: 10px; color: #666; text-align: center;">${appState.sankeyTopN}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="sankeyOriginFilter" style="font-size: 11px; color: #666;">Filtrar Origen</label>
                <select id="sankeyOriginFilter" style="padding: 5px 8px; font-size: 12px;" onchange="updateSankeyFilters()">
                    <option value="">Todas</option>
                </select>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="sankeyDestFilter" style="font-size: 11px; color: #666;">Filtrar Destino</label>
                <select id="sankeyDestFilter" style="padding: 5px 8px; font-size: 12px;" onchange="updateSankeyFilters()">
                    <option value="">Todas</option>
                </select>
            </div>
            <div style="display: flex; gap: 4px; align-self: flex-end;">
                <button class="btn" style="padding: 5px 8px; font-size: 12px;" onclick="sankeyZoom(1.2)">+</button>
                <button class="btn" style="padding: 5px 8px; font-size: 12px;" onclick="sankeyZoom(1/1.2)">−</button>
                <button class="btn" style="padding: 5px 8px; font-size: 12px;" onclick="sankeyZoomReset()">Reset</button>
            </div>
            <div id="sankeyStats" style="font-size: 11px; color: #666; align-self: flex-end; white-space: nowrap; margin-left: auto;">Mostrando: -- enlaces de --</div>
        `;
        // Re-popular los selects
        populateSankeyFilters();
    } else if (tabName === 'network') {
        toolbar.classList.remove('hidden');
        toolbar.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="networkTopN" style="font-size: 11px; color: #666;">Top-N aristas</label>
                <input type="range" id="networkTopN" min="5" max="500" step="5" value="${appState.networkTopN || 100}" 
                       style="width: 120px; height: 6px;"
                       oninput="updateNetworkTopN(this.value)">
                <span id="networkTopNVal" style="font-size: 10px; color: #666; text-align: center;">${appState.networkTopN || 100}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="networkOriginFilter" style="font-size: 11px; color: #666;">Filtrar Origen</label>
                <select id="networkOriginFilter" style="padding: 5px 8px; font-size: 12px;" onchange="updateNetworkFilters()">
                    <option value="">Todas</option>
                </select>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="networkDestFilter" style="font-size: 11px; color: #666;">Filtrar Destino</label>
                <select id="networkDestFilter" style="padding: 5px 8px; font-size: 12px;" onchange="updateNetworkFilters()">
                    <option value="">Todas</option>
                </select>
            </div>
            <div style="display: flex; gap: 4px; align-self: flex-end;">
                <button class="btn" style="padding: 5px 8px; font-size: 12px;" onclick="networkZoom(0.8)">−</button>
                <button class="btn" style="padding: 5px 8px; font-size: 12px;" onclick="networkZoom(1.2)">+</button>
                <button class="btn" style="padding: 5px 8px; font-size: 12px;" onclick="networkZoomReset()">Reset</button>
            </div>
            <div id="networkStats" style="font-size: 11px; color: #666; align-self: flex-end; white-space: nowrap;">Mostrando: -- aristas de --</div>
        `;
        populateNetworkFilters();
    } else {
        toolbar.classList.add('hidden');
        toolbar.innerHTML = '';
    }
}

/**
 * UI: Actualizar header con nombre de archivo
 */
function updateHeader() {
    const fileName = appState.fileName || '(ninguno)';
    const fileNameEl = document.getElementById('fileName');
    if (fileNameEl) {
        fileNameEl.textContent = `Archivo: ${fileName}`;
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
    console.log(`Ego-Network ${panelId} actualizada (implementación próxima)`);
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
        originSelect.innerHTML = '<option value="">Todas</option>';
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
        destSelect.innerHTML = '<option value="">Todas</option>';
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
        originSelect.innerHTML = '<option value="">Todas</option>';
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
        destSelect.innerHTML = '<option value="">Todas</option>';
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

    // Actualizar stats
    const statsEl = document.getElementById('sankeyStats');
    if (statsEl) {
        statsEl.textContent = `Mostrando: ${appState.aggregatedEdges.length} enlaces en total`;
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

    // Actualizar stats más detallado
    if (statsEl) {
        statsEl.textContent = `Mostrando: ${displayedEdges.length}/${appState.aggregatedEdges.length} enlaces`;
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
        .text(d => `${d.source.name} → ${d.target.name}\n${d.value.toLocaleString()} derivaciones`);

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
        statsEl.textContent = `Mostrando: ${displayedEdges.length}/${appState.aggregatedEdges.length} aristas`;
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
            title: `${nodeName} - Derivaciones: ${totalDerivations.toLocaleString()}`,
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
            title: `${edge.source} → ${edge.target}<br/>Derivaciones: ${edge.value.toLocaleString()}`,
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
                gravitationalConstant: -15000,
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