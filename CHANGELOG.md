# Changelog

## 2026-02-11

### Geographic Map — New features and fixes

- **Color by field selector**: optional dropdown in the map toolbar to assign colors to nodes based on a data column (e.g. grouped destinations).
- **Detailed tooltips**: origin nodes show a breakdown table with all destinations, weight per destination, and percentage. Destination nodes show the same for incoming origins. Nodes that are both show both sections.
- **Shape markers by node type**: circle = origin only, square = destination only, diamond = both. Shape legend displayed at bottom-left.
- **Line width 4–40px**: connection lines scale proportionally between 4px and 40px based on weight.
- **Expanded hitbox**: invisible 18px-wide polyline behind each edge for easier click interaction.
- **Interactive color legend**: clicking a legend item filters the map to show only the network associated with that group. Click again or press "✕ clear" to reset.
- **Map extent adjusted to data**: uses `fitBounds` with 30px padding instead of a fixed zoom level.
- **Edge drawing requires matching coordinates**: edges only render when the source has origin coordinates and the target has destination coordinates, preventing spurious lines when only one coordinate set is loaded.
