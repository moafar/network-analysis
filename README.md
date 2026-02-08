# Network Analysis — Interactive Referral Visualization

Aplicación web client-side para analizar y visualizar redes de referidos (o cualquier relación origen → destino) a partir de archivos Excel. No requiere backend: todo el procesamiento ocurre en el navegador.

---

## Qué hace

El usuario carga un archivo `.xlsx`, selecciona las columnas de **origen**, **destino** y opcionalmente **peso** y **coordenadas geográficas**, y la app genera cuatro visualizaciones interactivas:

| Pestaña | Descripción | Librería |
|---|---|---|
| **Sankey** | Diagrama de flujo que muestra el volumen de conexiones entre nodos. Soporta filtros por origen/destino y control de top-N. | D3 + d3-sankey |
| **Gravitational Network** | Grafo de red con layout de fuerzas. Nodos y aristas escalados por peso. | vis-network |
| **Ego Networks** | Cuatro paneles para comparar la red egocéntrica de hasta 4 destinos seleccionados simultáneamente. | vis-network |
| **Geographic Map** | Mapa con arcos entre orígenes y destinos usando coordenadas lat/lng (columnas opcionales). | Leaflet |

---

## Stack técnico

- **HTML/CSS/JS** vanilla — sin framework, sin bundler, sin Node.js.
- Las dependencias se cargan por CDN:
  - [SheetJS (XLSX)](https://cdn.jsdelivr.net/npm/xlsx@0.18.5) — parseo de archivos Excel
  - [D3 v7](https://d3js.org/d3.v7.min.js) + [d3-sankey](https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3)
  - [vis-network](https://unpkg.com/vis-network/standalone/umd/vis-network.min.js) — grafos interactivos
  - [Leaflet 1.9.4](https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js) — mapas

---

## Estructura de archivos

```
├── index.html          # Layout: header, tabs, contenedores de visualización, carga de CDNs
├── app.js              # Estado global (appState), lógica de negocio, parseo Excel,
│                       #   procesamiento de datos, rendering de las 4 visualizaciones
├── presentation.js     # Event listeners del DOM (delegación en toolbar, tabs, selects)
├── styles.css          # Estilos de toda la app (header, tabs, visualizaciones, responsivo)
└── README.md
```

### `app.js` — módulos lógicos principales

| Sección | Funciones clave | Líneas aprox. |
|---|---|---|
| Estado global | `appState` (objeto mutable con todo el estado) | 1–33 |
| Carga de datos | `handleFileSelect()`, `parseExcelData()`, `populateColumnSelects()` | 79–210 |
| Procesamiento | `handleColumnChange()`, `processAggregatedEdges()`, `buildIndices()` | 213–390 |
| Tabs & UI | `switchTab()`, `showTabControls()`, `showStatus()` | 394–548 |
| Ego Networks | `updateEgoNetwork()` | 550–837 |
| Sankey | `renderSankey()`, filtros y zoom | 857–1296 |
| Network | `renderNetwork()`, filtros y zoom | 1298–1576 |
| Mapa geográfico | `extractNodeCoordinates()`, `renderMap()` | 1578–1797 |

### `presentation.js`

Archivo ligero (~90 líneas) que registra todos los event listeners del DOM usando delegación de eventos. Separa la capa de presentación de la lógica de negocio en `app.js`.

---

## Cómo ejecutar

Solo necesitas servir los archivos estáticamente. Cualquiera de estas opciones funciona:

```bash
# Python
python3 -m http.server 8000

# Node.js (si tienes npx)
npx serve .

# VS Code
# Usa la extensión "Live Server" y abre index.html
```

Luego abre `http://localhost:8000` en el navegador.

> **Nota:** Abrir `index.html` directamente con `file://` puede fallar por restricciones CORS al cargar librerías de CDN.

---

## Flujo de uso

1. Click en **Load Excel** → seleccionar un archivo `.xlsx`
2. Si el archivo tiene múltiples hojas, se pide seleccionar una
3. Seleccionar las columnas **Origin** y **Destination** en los dropdowns del header
4. (Opcional) Seleccionar columna de **Weight** — si no se selecciona, se cuenta frecuencia automáticamente
5. (Opcional) Seleccionar columnas de coordenadas para habilitar el mapa geográfico
6. Las visualizaciones se generan automáticamente al configurar las columnas

---

## Arquitectura y flujo de datos

```
Excel (.xlsx)
  │
  ▼
handleFileSelect() → parseExcelData()     ← SheetJS
  │
  ▼
appState.headers / appState.rows          ← datos crudos
  │
  ▼
handleColumnChange()
  │
  ├── processAggregatedEdges()            ← agrega pares (origin, dest) → weight
  ├── buildIndices()                      ← outIndex / inIndex (Map de adjacencia)
  └── populateEgoDestinations()
  │
  ▼
Render en la pestaña activa:
  ├── renderSankey()      → SVG con D3
  ├── renderNetwork()     → Canvas con vis-network
  ├── updateEgoNetwork()  → 4× Canvas con vis-network
  └── renderMap()         → Leaflet tiles + polylines
```

El estado es un **objeto global mutable** (`appState`). No hay reactividad ni sistema de componentes: las funciones de render leen directamente de `appState` y escriben en el DOM.

---

## Convenciones

- Los mensajes de UI están en **inglés**; los comentarios internos del código en **español**.
- No hay sistema de build ni minificación — se edita y se sirve directamente.
- Las funciones de `app.js` son globales (window scope) para que `presentation.js` las invoque por nombre.

---

## Requerimientos del navegador

- Navegador moderno con soporte de ES2017+ (`async/await`, `Map`, `Set`, template literals).
- Conexión a internet para cargar las librerías por CDN (o cachearlas localmente).
