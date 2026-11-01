# SuJal backend

Small Flask API for ESP32 telemetry ingestion and React dashboard reads, backed by MongoDB Atlas.

## Start locally

1. Create a MongoDB Atlas cluster and database user. Add your current network IP to the Atlas network access list.
2. Copy `.env.example` to `.env` and fill in `MONGODB_URI`. Do not commit `.env` or share its secrets.
3. From this directory, create/activate a Python virtual environment, install `requirements.txt`, then run `python app.py`.
4. With the supplied example configuration, check `GET http://localhost:5001/api/health`.

The API listens on all interfaces so the ESP32 can reach the laptop on the same Wi-Fi. Use the laptop's LAN IP in the ESP32 URL, not `localhost`. Atlas still needs internet access.

## API

### `POST /api/v1/readings`

Required header: `X-Device-Token: <DEVICE_API_TOKEN>`. Configure a new secret in `backend/.env`; the API rejects ingestion if the token is missing or unconfigured.

```json
{
  "node_id": "SJ-001",
  "event_id": "esp32-boot7-reading42",
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

Every packet needs a unique `event_id` (or an `Idempotency-Key` header). The ESP32 must reuse that same event ID if it retries a timed-out request; a unique MongoDB index prevents a duplicate reading. Use a new event ID for every new sensor packet.

The ESP32 does not send `phase` or `run_id`. The backend assigns the first new reading for a node to `inlet`, the next to `outlet`, and continues alternating. It creates an internal pair ID and returns the assigned phase and pair ID in the response. Duplicate retries return the original assignment without advancing the sequence. Keep inlet and outlet samples in the intended order; the backend cannot identify which tank the sensor is physically in.

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

### `GET /api/v1/nodes/<node_id>/archives`

Lists UTC months that have readings for this node, with each month's count and first/last timestamps.

### `GET /api/v1/nodes/<node_id>/archives/<YYYY-MM>.csv`

Downloads a CSV containing all stored readings for that node in the requested UTC month. MongoDB remains the permanent history store; the CSV is generated from those saved records when requested, so there is no dependency on temporary files on the API server.

### `GET /api/v1/nodes/<node_id>/runs/<run_id>/comparison`

Returns `waiting_for_pair` until both automatically paired readings arrive, then returns their measurements and numeric changes. Use the internal `run_id` returned by the ingestion response in this dashboard/backend request; the ESP32 does not need to send it.

### `GET /api/v1/nodes/<node_id>/alerts?status=open`

Returns open alerts for the node. `status` can be `open`, `acknowledged`, `resolved`, or `all`.

### `PATCH /api/v1/alerts/<alert_id>`

Set an alert to `acknowledged` or `resolved`; optionally include an `operator_note`.

### `GET /api/v1/nodes/<node_id>/telemetry-completeness`

Compares packets received with the configured expected reporting interval over up to the latest hour. It returns `not_configured` until `EXPECTED_INTERVAL_SECONDS` is set.

### `GET /api/v1/nodes/<node_id>/averages/6-hour?date=YYYY-MM-DD`

Returns four six-hour buckets for an IST calendar day, excluding missing or invalid sensor values and reporting valid/excluded counts. The date is optional and defaults to today in IST. Each request refreshes the materialized bucket snapshots in `six_hour_averages` from the canonical raw readings; the endpoint does not alter the raw records.

## Current operational rules

- Turbidity above `TURBIDITY_OPERATING_LIMIT_NTU` creates one open operational alert for the node and rule. The starter defaults to 5.0 NTU to match the illustrative dashboard mock; change this after agreeing on a demo threshold. It is not a universal water-safety limit.
- pH outside `PH_MIN_OPERATING`..`PH_MAX_OPERATING` and temperature outside `TEMP_MIN_OPERATING_C`..`TEMP_MAX_OPERATING_C` create operating-range alerts. The example values are demo settings, not a safety assessment.
- MQ-5 alerts are disabled until the team sets `MQ5_ADC_ALERT_THRESHOLD` or confirms the board's digital output polarity and sets `MQ5_DIGITAL_ALARM_VALUE` to `0` or `1`. These alerts describe a headspace sensor signal only.
- If `ACTIVE_FLOW_MIN_LPM` is configured, flow below it in the declared active branch creates an operational alert to inspect the filter, pump, and sensor. Keep it unset until you establish a repeatable baseline.
- A low-flow packet returns a suggested failover action. The ESP32 must validate and actuate valves locally; the API itself does not control valves.
- Missing pH, turbidity, or temperature in a packet creates a data-quality warning.
- Repeated triggering packets update the same open alert instead of creating a new alert each time. Acknowledging/resolving an alert lets a later event create a new one.
- MQ-5 values are stored as gas-sensor signals from above the water. They do not trigger water-quality or safety classifications.
- No rule labels the water safe or unsafe. Limits must be named and displayed as node-configured operating/demo thresholds unless a separate validated standard comparison is explicitly implemented.

## MongoDB collections

- `readings`: append-only timestamped sensor packets, including device status and branch information.
- `alerts`: operator-review alerts generated by the configured operational rules.
- `nodes`: manually or GPS-configured node profile and location metadata.
- `six_hour_averages`: refreshable per-node, per-IST-day six-hour aggregate snapshots.

CSV archives are generated from `readings`; they are not separate copies stored in another collection. Download a month to keep or share an export. The export includes the sensor values and JSON columns for flow readings and device status.

## Integration notes

- Set `CORS_ORIGINS` to the frontend origin(s).
- The ESP32 should POST JSON to `http://<laptop-LAN-IP>:<PORT>/api/v1/readings` while both devices are on the same network (`PORT` is 5001 in `.env.example`).
- Keep credentials in environment variables. Never place the Atlas URI or device token in React source code.
- Sensor calibration must still be checked against suitable references. The 5.0 NTU fallback and values in `.env` are operational/demo alert thresholds, not safety standards.
