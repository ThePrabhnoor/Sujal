# SuJal backend

Small Flask API for ESP32 telemetry ingestion and React dashboard reads, backed by MongoDB Atlas.

## Start locally

1. Create a MongoDB Atlas cluster and database user. Add your current network IP to the Atlas network access list.
2. Copy `.env.example` to `.env` and fill in `MONGODB_URI`. Do not commit `.env` or share its secrets.
3. From this directory, create/activate a Python virtual environment, install `requirements.txt`, then run `python app.py`.
4. Check `GET http://localhost:5000/api/health`.

The API listens on all interfaces so the ESP32 can reach the laptop on the same Wi-Fi. Use the laptop's LAN IP in the ESP32 URL, not `localhost`. Atlas still needs internet access.

## API

### `POST /api/v1/readings`

Optional header: `X-Device-Token: <DEVICE_API_TOKEN>` (required when `DEVICE_API_TOKEN` is set).

```json
{
  "node_id": "SJ-001",
  "run_id": "RUN-2026-10-29-001",
  "phase": "inlet",
  "timestamp": "2026-10-29T10:32:15Z",
  "active_branch": "A",
  "measurements": {
    "ph": 7.2,
    "turbidity_ntu": 5.8,
    "temperature_c": 24.6,
    "mq5_adc": 1830,
    "mq5_digital": 0,
    "flow_lpm": {
      "inlet": 2.4,
      "branch_a": 2.3,
      "branch_b": 0.0
    }
  },
  "device_status": {
    "wifi": "connected",
    "valve_a": "open",
    "valve_b": "closed"
  }
}
```

Send one packet with `phase: "inlet"` and one with `phase: "outlet"`, using the **same `run_id`** for the paired test. The endpoint will wait for both before returning a comparison. A run should refer to the same controlled test/sample; do not pair measurements from unrelated water samples.

`mq5_adc` is an uncalibrated gas-sensor signal from above the water, not a gas concentration or water-quality score. Flow sensor keys can reflect the actual plumbing locations; omit unavailable readings. Calibrated pH/turbidity/flow values should include the units shown in the field names. The comparison endpoint reports numeric changes and a turbidity reduction percentage when possible; it does not make a safety determination.

### `PUT /api/v1/nodes/<node_id>/profile`

Saves node name and location metadata for the Map/Profile screens. Use `location.source: "manual"` for a fixed surveyed location unless the device is actually equipped to provide GPS coordinates. Keep `verified: false` until the location is checked.

```json
{
  "name": "Locality checkpoint 1",
  "address": "Optional site description",
  "location": {
    "latitude": 28.6,
    "longitude": 77.2,
    "source": "manual",
    "verified": false
  }
}
```

The coordinates above are examples only. Replace them with your actual test node's coordinates; do not present example coordinates as a live GPS position.

### `GET /api/v1/nodes/<node_id>/profile`

Returns the saved node profile.

### `GET /api/v1/nodes`

Returns saved node profiles for a map/list view.

### `GET /api/v1/nodes/<node_id>/latest`

Returns the newest stored reading for a node.

### `GET /api/v1/nodes/<node_id>/readings?limit=100`

Returns up to 1000 newest readings for charts/history.

### `GET /api/v1/nodes/<node_id>/runs/<run_id>/comparison`

Returns `waiting_for_pair` until both the inlet and outlet packets arrive for that run, then returns their paired readings and numeric changes.

### `GET /api/v1/nodes/<node_id>/alerts?status=open`

Returns open alerts for the node. `status` can be `open`, `acknowledged`, `resolved`, or `all`.

### `PATCH /api/v1/alerts/<alert_id>`

Set an alert to `acknowledged` or `resolved`; optionally include an `operator_note`.

### `GET /api/v1/nodes/<node_id>/telemetry-completeness`

Compares packets received with the configured expected reporting interval over up to the latest hour. It returns `not_configured` until `EXPECTED_INTERVAL_SECONDS` is set.

## Current operational rules

- Turbidity above `TURBIDITY_OPERATING_LIMIT_NTU` creates one open operational alert for the node and rule. The starter defaults to 5.0 NTU to match the illustrative dashboard mock; change this after agreeing on a demo threshold. It is not a universal water-safety limit.
- If `ACTIVE_FLOW_MIN_LPM` is configured, flow below it in the declared active branch creates an operational alert to inspect the filter, pump, and sensor. Keep it unset until you establish a repeatable baseline.
- Missing pH, turbidity, or temperature in a packet creates a data-quality warning.
- Repeated triggering packets update the same open alert instead of creating a new alert each time. Acknowledging/resolving an alert lets a later event create a new one.
- MQ-5 values are stored as gas-sensor signals from above the water. They do not trigger water-quality or safety classifications.
- No rule labels the water safe or unsafe. Limits must be named and displayed as node-configured operating/demo thresholds unless a separate validated standard comparison is explicitly implemented.

## MongoDB collections

- `readings`: append-only timestamped sensor packets, including device status and branch information.
- Additional collections such as `alerts` should be added only after the team agrees on alert rules and thresholds. The initial API does not classify water as safe/unsafe or infer gas concentration.

## Integration notes

- Set `CORS_ORIGINS` to the frontend origin(s).
- The ESP32 should POST JSON to `http://<laptop-LAN-IP>:5000/api/v1/readings` while both devices are on the same network.
- Keep credentials in environment variables. Never place the Atlas URI or device token in React source code.
- Sensor calibration and alert limits are intentionally not hard-coded in this starter.
