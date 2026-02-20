# Changelog

## 2026-02-20

### Geographic Map — Legend filter behavior

- **Legend selection now focuses on destination group**: clicking a color in the map legend filters the map to show only edges whose *target* (destination) belongs to the selected group. This makes the view represent "the network feeding that destination group".
- **Consistent group coloring when focused**: when a legend group is active, all displayed nodes (the matched destinations and their connected origins) are rendered using the selected group's color so the user clearly sees the network for that destination.
- **Rationale**: previously the filter kept edges when either endpoint matched the group (OR logic), which left other-colored nodes visible and caused confusion. The new behavior matches the expected "focus on destination group" UX.

## 2026-02-12

### Geographic Map — Cost metric & view preservation

- **Cost mode toggle**: new "Cost" button in the map toolbar. When active, each edge's line width is proportional to *distance × weight* (Haversine distance in km multiplied by the edge weight), enabling spatial-cost analysis at a glance.
- **Distance in edge tooltips**: edge popups now always show the Haversine distance (km) between origin and destination. When cost mode is active, the computed cost value is also displayed.
- **View preservation on re-render**: toggling cost mode, changing filters (origin, destination, color-by), or clicking legend items no longer resets the map zoom and center. The existing Leaflet instance is reused and only overlay layers are redrawn.
- **Full map recreation on coordinate changes**: selecting different coordinate columns destroys and recreates the map with `fitBounds`, correctly adjusting the extent to the new data.

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
