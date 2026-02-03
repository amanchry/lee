# Local Earth Engine

A production-quality React frontend for a GEE-like geospatial analysis dashboard.

## Features

- **Left Panel**: Scripts manager and Assets manager
- **Center Panel**: Code editor and Console with logs/errors
- **Right Panel**: Map viewer with layers panel and inspector
- **Job Simulation**: Run scripts and simulate job lifecycle (queued → running → completed)
- **Layer Management**: Add, toggle, delete, and adjust opacity of visualization layers
- **Map Interaction**: Click on map to inspect coordinates and pixel values

## Tech Stack

- React + JavaScript
- Radix UI (Dialog, Tabs, Dropdown, ContextMenu, Tooltip, Toast, ScrollArea)
- TailwindCSS for styling
- MapLibre GL JS for map visualization
- lucide-react for icons

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## Usage

1. **Scripts**: Create, edit, and delete Python scripts in the left panel
2. **Run**: Click the "Run" button to execute a script and simulate job processing
3. **Console**: View logs, errors, and job status in the Console tab
4. **Map**: Visualize outputs on the map viewer
5. **Layers**: Manage visualization layers in the Layers panel
6. **Inspector**: Click on the map to inspect coordinates and pixel values

## Project Structure

```
src/
  ├── components/
  │   ├── LeftPanel.jsx      # Scripts and Assets manager
  │   ├── CenterPanel.jsx    # Code editor and Console
  │   ├── RightPanel.jsx     # Map, Layers, Inspector tabs
  │   ├── MapViewer.jsx      # MapLibre GL map component
  │   ├── LayersPanel.jsx    # Layer management UI
  │   ├── Inspector.jsx      # Map click inspector
  │   └── Toaster.jsx        # Toast notifications
  ├── App.jsx                # Main app component
  ├── main.jsx               # Entry point
  └── index.css              # Global styles
```

## Notes

- This is a frontend-only implementation with mocked APIs
- Script execution is simulated with a job lifecycle
- Map layers are added dynamically based on script outputs
- All UI interactions are functional and ready for backend integration
