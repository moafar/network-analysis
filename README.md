# Referrals - Interactive Network

Lightweight web application (HTML + CSS + vanilla JavaScript) to load an Excel file and visualize network interactions from three perspectives: **Sankey**, **Gravitational Network**, and **Ego Networks**.

## 🚀 Quick Start

1. **Open `index.html` directly in your browser** (double-click or drag into a tab).
   - Alternatively, run a simple static server:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Or Node.js (with http-server installed globally)
     http-server
     ```
   - Then visit `http://localhost:8000`.

2. **Load an Excel file (.xlsx or .xls)**
   - Click the **Load Excel** button
   - Select the sheet to process (if there are multiple)
   - The file is processed locally in your browser

3. **Configure the columns**
   - **Origin**: source column
   - **Destination**: target column
   - **Weight** (optional): numeric column; if not selected, counts are used

4. **Explore the three tabs**
   - **Sankey**: flows from origin to destination with link width proportional to value
   - **Gravitational Network**: interactive graph using Barnes-Hut physics
   - **Ego Networks**: four independent subnetworks centered on chosen destinations

## 📋 File Structure

```
derivaciones/
├── index.html          # Markup + styles
├── app.js              # Main logic: loading, parsing, state
├── README.md           # This file
└── AGENT_PROMPT.md.yaml # Original spec
```

## 📚 Technologies & CDNs

| Library | Purpose | CDN |
|---------|---------|-----|
| **XLSX.js** | Parse Excel files | `cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js` |
| **D3.js v7** | Data visualization | `d3js.org/d3.v7.min.js` |
| **d3-sankey** | Sankey diagrams | `cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js` |
| **vis-network** | Interactive graphs | `unpkg.com/vis-network/standalone/umd/vis-network.min.js` |

All libraries are loaded from public CDNs. Ensure you have internet connectivity.

## ⚙️ Expected Excel Format

Required structure:
- **Headers** (first row): column names
- **Data**: rows containing origin, destination and optional weight

Example:
| origin | destination | value |
|--------|-------------|-------|
| A      | B           | 10    |
| B      | C           | 5     |
| A      | C           | 3     |

## ✅ Acceptance Criteria (Current - Phase 1)

### Implemented ✓
- [x] Load Excel (.xlsx, .xls)
- [x] Sheet selection when multiple sheets exist
- [x] Parse headers and rows
- [x] Populate column selectors dynamically
- [x] Enforce origin ≠ destination
- [x] Aggregate edges (count or weight)
- [x] Build indices for fast lookup
- [x] Clear validation and error messages
- [x] Clean UI: header + tabs + main area
- [x] Responsive layout

### Next Phases
- [ ] **Sankey**: Top-N slider, D3 rendering, tooltips
- [ ] **Network**: vis-network with barnesHut, loading bar, filters
- [ ] **Ego Networks**: 4 subnets with selectors
- [ ] Advanced filters (origin/destination specific)

## 🛑 Known Limits

1. **Dataset size**: Optimized for ~10k edges. Very large datasets (>100k) may be slow.
2. **Null values**: Ignored silently (won't break the app).
3. **Data types**: Origin/destination columns are treated as strings; weight must be numeric.
4. **No persistence**: Data is not saved between loads.
5. **Browser support**: Modern browsers recommended (Chrome, Firefox, Safari, Edge 2018+).

## 🐛 Troubleshooting

### "Error loading file"
- Ensure the file is a valid `.xlsx` or `.xls`.
- Make sure the file is not open in another application.

### Empty selectors after load
- Make sure your Excel has headers in the first row.

### "Select Origin and Destination" message
- Fill both selectors to proceed.

### Visualizations not appearing
- Open the browser console (F12) for errors
- Check CDN connectivity

## 📝 Development Notes

- **Centralized state**: `appState` holds headers, rows, edges and indices
- **Modular rendering**: each tab has its own renderer
- **No bundler**: plain JS + CDNs; open in the browser without build

## 📞 Support

If you hit issues:
1. Check browser console (F12 → Console)
2. Verify the Excel structure
3. Try a smaller dataset first

---

**Version**: 0.1 (Skeleton - Phase 1)  
**Last updated**: February 2026
