# Derivaciones - Red Interactiva

Aplicación web ligera (HTML + CSS + JavaScript vanilla) para cargar un archivo Excel y visualizar interacciones en red mediante tres perspectivas: **Sankey**, **Red Gravitacional**, y **Ego-Networks**.

## 🚀 Inicio Rápido

1. **Abre `index.html` directamente en tu navegador** (con doble click o arrastrando a la pestaña).
   - Alternativamente, usa un servidor estático simple:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # O Node.js (con http-server instalado globalmente)
     http-server
     ```
   - Luego accede a `http://localhost:8000`

2. **Carga un archivo Excel (.xlsx o .xls)**
   - Haz click en "Cargar Excel"
   - Selecciona la hoja a procesar (si hay múltiples)
   - El archivo se procesa localmente en el navegador

3. **Configura las columnas**
   - **Origen**: columna de fuente/emisor
   - **Destino**: columna de destino/receptor
   - **Peso** (opcional): columna con valores numéricos. Si no seleccionas, se usa conteo.

4. **Explora las tres pestañas**
   - **Sankey**: Flujos de origen a destino con grosor proporcional al valor
   - **Red Gravitacional**: Grafo interactivo con física barnesHut
   - **Ego-Networks**: 4 subredes independientes, cada una centrada en un nodo destino

## 📋 Estructura de Archivos

```
derivaciones/
├── index.html          # Estructura + estilos (todo integrado)
├── app.js              # Lógica principal: carga, parsing, estado
├── README.md           # Este archivo
└── AGENT_PROMPT.md.yaml # Especificación original
```

## 📚 Tecnologías & CDNs

| Librería | Propósito | CDN |
|----------|-----------|-----|
| **XLSX.js** | Parsear archivos Excel | `cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js` |
| **D3.js v7** | Visualización de datos | `d3js.org/d3.v7.min.js` |
| **d3-sankey** | Diagramas Sankey | `cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js` |
| **vis-network** | Grafos interactivos | `unpkg.com/vis-network/standalone/umd/vis-network.min.js` |

Todas las librerías se cargan desde CDN públicos. Verifica conectividad a internet.

## ⚙️ Formato Esperado del Excel

El archivo debe tener:
- **Headers** (primera fila): nombres de columnas
- **Datos**: filas con valores para origen, destino, y opcionalmente peso

Ejemplo:
| origen | destino | valor |
|--------|---------|-------|
| A      | B       | 10    |
| B      | C       | 5     |
| A      | C       | 3     |

## ✅ Criterios de Aceptación (Estado Actual - Fase 1)

### Implementado ✓
- [x] Carga de archivo Excel (.xlsx, .xls)
- [x] Selección de hoja si hay múltiples
- [x] Parsing de headers y rows
- [x] Poblado dinámico de selectores de columnas
- [x] Exclusión mutua: origen ≠ destino
- [x] Agregación de edges (conteo o peso)
- [x] Construcción de índices para búsquedas rápidas
- [x] Validación y mensajes de error claros
- [x] Interfaz limpia: header + sidebar + tabs + área principal
- [x] Responsivo (mobile-friendly)

### Próximas Fases
- [ ] **Sankey**: slider Top-N, renderización D3, tooltips
- [ ] **Red**: vis-network con barnesHut, loadingBar, filtros
- [ ] **Ego-Networks**: 4 subredes independientes con selectores
- [ ] Filtros avanzados (origen/destino específicos)
- [ ] Refactorización modular si es necesario

## 🛑 Límites Conocidos

1. **Tamaño de dataset**: Optimizado para ~10k aristas. Datasets muy grandes (>100k) pueden ser lentos.
2. **Valores nulos**: Se ignoran silenciosamente (no rompen la aplicación).
3. **Tipos de datos**: La columna de origen/destino se convierte a string. La columna de peso debe ser numérica.
4. **Sin persistencia**: Los datos no se guardan; cada carga comienza desde cero.
5. **Browser compatibility**: Requiere navegadores modernos (Chrome, Firefox, Safari, Edge 2018+).

## 🐛 Troubleshooting

### "Error al cargar el archivo"
- Verifica que sea un `.xlsx` o `.xls` válido
- Comprueba que el archivo no esté abierto en otra aplicación

### Selectors vacíos tras cargar
- Asegúrate de que el Excel tenga headers en la primera fila

### Mensajes "Selecciona Origen y Destino"
- Completa ambos selectores

### Las visualizaciones no aparecen
- Abre la consola del navegador (F12) y verifica mensajes de error
- Comprueba conectividad a los CDNs

## 📝 Notas de Desarrollo

- **Estado centralizado**: `appState` contiene todo (headers, rows, edges, índices)
- **Modularidad**: Cada tab tendrá su propia función de renderización
- **Sin bundler**: Todo es vanilla JS + CDNs; abre en navegador sin build
- **Mejoras futuras**:
  - Exportar datos/visualizaciones (PNG, SVG, CSV)
  - Caché en localStorage
  - Soporte para archivos CSV
  - Análisis de métricas (centralidad, clustering, etc.)

## 📞 Soporte

Si encuentras issues:
1. Revisa la consola del navegador (F12 → Console)
2. Verifica que el archivo Excel tenga la estructura esperada
3. Intenta con un dataset más pequeño primero

---

**Versión**: 0.1 (Esqueleto - Fase 1)  
**Última actualización**: Febrero 2026
