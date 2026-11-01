# SuJal React Telemetry & Control Frontend

Production-ready React + TypeScript + Tailwind CSS application replicating the Figma design for the **SuJal** water telemetry and filtration control station.

## Features Replicated from Figma

1. **Dashboard Overview (`/`)**:
   - 4 Hero KPI Cards with sparklines, status badges, and operating limit alerts:
     - pH Level (with 6.5 – 8.5 target range)
     - Turbidity NTU (Inlet vs Outlet filtration delta, `-38.3%` reduction badge)
     - Water Temperature (°C)
     - Active Branch Flow (LPM)
   - Secondary Hardware Telemetry:
     - Filtration efficiency delta gauge
     - Solenoid valve status indicators (Valve A [OPEN] / Valve B [CLOSED])
     - MQ-5 Headspace Gas Sensor (ADC uncalibrated signal + Digital alarm status)
     - Telemetry packet completeness ratio (99.5% delivery, 30s cadence)
   - 4 Interactive Real-time SVG Charts with threshold reference lines, tooltips, and legends:
     - pH Sensor Telemetry
     - Turbidity (Inlet vs Outlet)
     - Water Temperature Stream
     - Multi-Branch Flow Rate Monitoring

2. **Geographic Map & Nodes View (`#/map`)**:
   - Stylized dark vector geographic map with topological contours and Yamuna canal waterway
   - Animated water flow lines across water pipelines
   - Node status pins with pulsing radar sweep and verified survey status badges
   - Floating live telemetry card overlay with mini sparklines and instant readings

3. **Interactive Plumbing & Solenoid Schematic (`#/schematic`)**:
   - Fluid flow animations using SVG dash-offset keyframes
   - Solenoid Valve A & Solenoid Valve B with interactive state toggling (Open / Closed)
   - Filter Bed A & Filter Bed B (Activated Carbon & Dual-Stage Ceramic)
   - Flow meter readouts and hydraulic pressure differential monitoring

4. **Telemetry Log History Table (`#/history`)**:
   - Comprehensive data table with search, phase filtering (`Inlet` vs `Outlet`), and CSV export
   - Reading Inspector Drawer that slides in with Framer Motion, displaying calibrated units and raw JSON document payloads

5. **Operational Alerts & Monthly Archives (`#/alerts`)**:
   - Alert management queue with severity badges (`High`, `Warning`, `Info`)
   - Interactive `Acknowledge` and `Resolve` workflows
   - Permanent Monthly Telemetry Archives table with one-click CSV downloads (`YYYY-MM.csv`)

6. **Run Comparison & Telemetry Diagnostics (`#/diagnostics`)**:
   - Automated paired run comparison (Inlet vs Outlet side-by-side delta)
   - Turbidity reduction percentage calculation
   - Telemetry cadence and packet drop rate analyzer
   - Live ESP32 POST request simulator

7. **Thresholds & Station Profile Settings (`#/settings`)**:
   - Configurable rule-based operational limits (Turbidity limit, pH range, Temp range, MQ-5 ADC threshold)
   - Station survey profile editor (Node ID, display name, address, coordinates, GPS vs manual source toggle)

## How to Run

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Start Vite development server
npm run dev

# 3. Open in browser
# http://localhost:5173
```

