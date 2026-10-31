"""SuJal telemetry API: Flask + MongoDB Atlas."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import wraps
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import DESCENDING, MongoClient
from pymongo.errors import PyMongoError
from rules import evaluate_reading

load_dotenv()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_timestamp(value: Any) -> datetime:
    if value is None:
        return utc_now()
    if not isinstance(value, str):
        raise ValueError("timestamp must be an ISO-8601 string")
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError("timestamp must be a valid ISO-8601 string") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def finite_number(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{field} must be a number")
    number = float(value)
    if number != number or number in (float("inf"), float("-inf")):
        raise ValueError(f"{field} must be finite")
    return number


def validate_reading(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("request body must be a JSON object")
    node_id = payload.get("node_id")
    if not isinstance(node_id, str) or not node_id.strip():
        raise ValueError("node_id is required")

    measurements = payload.get("measurements")
    if not isinstance(measurements, dict):
        raise ValueError("measurements must be a JSON object")

    allowed = {"ph", "turbidity_ntu", "temperature_c", "mq5_adc", "mq5_digital"}
    cleaned: dict[str, Any] = {}
    for field in allowed:
        if field not in measurements or measurements[field] is None:
            continue
        if field == "mq5_digital":
            if measurements[field] not in (0, 1, False, True):
                raise ValueError("measurements.mq5_digital must be 0 or 1")
            cleaned[field] = int(measurements[field])
        else:
            cleaned[field] = finite_number(measurements[field], f"measurements.{field}")

    flow = measurements.get("flow_lpm", {})
    if flow is not None:
        if not isinstance(flow, dict):
            raise ValueError("measurements.flow_lpm must be an object keyed by sensor/branch")
        cleaned_flow = {}
        for sensor_name, value in flow.items():
            if not isinstance(sensor_name, str) or not sensor_name.strip():
                raise ValueError("flow_lpm keys must be non-empty strings")
            cleaned_flow[sensor_name] = finite_number(value, f"measurements.flow_lpm.{sensor_name}")
        if cleaned_flow:
            cleaned["flow_lpm"] = cleaned_flow

    if not cleaned:
        raise ValueError("at least one sensor measurement is required")

    branch = payload.get("active_branch")
    if branch is not None and branch not in ("A", "B", "none"):
        raise ValueError("active_branch must be A, B, or none")

    run_id = payload.get("run_id")
    phase = payload.get("phase")
    if (run_id is None) != (phase is None):
        raise ValueError("run_id and phase must be provided together")
    if run_id is not None:
        if not isinstance(run_id, str) or not run_id.strip():
            raise ValueError("run_id must be a non-empty string")
        if phase not in ("inlet", "outlet"):
            raise ValueError("phase must be inlet or outlet")

    device_status = payload.get("device_status", {})
    if not isinstance(device_status, dict):
        raise ValueError("device_status must be a JSON object")

    return {
        "node_id": node_id.strip(),
        "run_id": run_id.strip() if isinstance(run_id, str) else None,
        "phase": phase,
        "recorded_at": parse_timestamp(payload.get("timestamp")),
        "received_at": utc_now(),
        "measurements": cleaned,
        "active_branch": branch,
        "device_status": device_status,
        "source": "esp32",
    }


def create_app() -> Flask:
    app = Flask(__name__)
    origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if origin.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins}})

    uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DATABASE", "sujal")
    mongo_client = MongoClient(uri, serverSelectionTimeoutMS=4000) if uri else None
    database = mongo_client[database_name] if mongo_client is not None else None
    app.extensions["mongo_client"] = mongo_client
    app.extensions["sujal_db"] = database

    def db_or_error():
        if database is None:
            return None, (jsonify(error="MongoDB is not configured", hint="Set MONGODB_URI in backend/.env"), 503)
        return database, None

    def require_device_token(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            expected = os.getenv("DEVICE_API_TOKEN", "").strip()
            if expected and request.headers.get("X-Device-Token", "") != expected:
                return jsonify(error="unauthorized device"), 401
            return handler(*args, **kwargs)
        return wrapped

    @app.get("/api/health")
    def health():
        if database is None:
            return jsonify(status="degraded", api="ok", database="not_configured"), 503
        try:
            mongo_client.admin.command("ping")
            return jsonify(status="ok", api="ok", database="connected")
        except PyMongoError:
            app.logger.exception("MongoDB health check failed")
            return jsonify(status="degraded", api="ok", database="unavailable"), 503

    @app.put("/api/v1/nodes/<node_id>/profile")
    @require_device_token
    def save_node_profile(node_id: str):
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="request body must be a JSON object"), 400
        name = body.get("name", node_id)
        location = body.get("location")
        if not isinstance(name, str) or not name.strip():
            return jsonify(error="name must be a non-empty string"), 400
        if not isinstance(location, dict):
            return jsonify(error="location must include latitude and longitude"), 400
        try:
            latitude = finite_number(location.get("latitude"), "location.latitude")
            longitude = finite_number(location.get("longitude"), "location.longitude")
        except ValueError as exc:
            return jsonify(error=str(exc)), 400
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            return jsonify(error="latitude must be -90..90 and longitude -180..180"), 400
        source = location.get("source", "manual")
        if source not in ("manual", "gps"):
            return jsonify(error="location.source must be manual or gps"), 400
        verified = location.get("verified", False)
        if not isinstance(verified, bool):
            return jsonify(error="location.verified must be true or false"), 400

        database, error = db_or_error()
        if error:
            return error
        now = utc_now()
        profile = {
            "node_id": node_id,
            "name": name.strip(),
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "source": source,
                "verified": verified,
            },
            "updated_at": now,
        }
        if isinstance(body.get("address"), str):
            profile["address"] = body["address"].strip()
        try:
            database.nodes.update_one(
                {"node_id": node_id},
                {"$set": profile, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
            response_profile = dict(profile)
            response_profile["updated_at"] = now.isoformat()
            return jsonify(ok=True, **response_profile), 200
        except PyMongoError:
            app.logger.exception("Failed to save node profile")
            return jsonify(error="failed to save node profile"), 503

    @app.get("/api/v1/nodes/<node_id>/profile")
    def get_node_profile(node_id: str):
        database, error = db_or_error()
        if error:
            return error
        try:
            profile = database.nodes.find_one({"node_id": node_id}, {"_id": 0})
            if profile is None:
                return jsonify(error="node profile not found", node_id=node_id), 404
            for field in ("created_at", "updated_at"):
                if profile.get(field):
                    profile[field] = profile[field].isoformat()
            return jsonify(profile)
        except PyMongoError:
            app.logger.exception("Failed to fetch node profile")
            return jsonify(error="failed to fetch node profile"), 503

    @app.get("/api/v1/nodes")
    def list_nodes():
        database, error = db_or_error()
        if error:
            return error
        try:
            nodes = list(database.nodes.find({}, {"_id": 0}).sort("node_id", 1).limit(500))
            for node in nodes:
                for field in ("created_at", "updated_at"):
                    if node.get(field):
                        node[field] = node[field].isoformat()
            return jsonify(count=len(nodes), nodes=nodes)
        except PyMongoError:
            app.logger.exception("Failed to list node profiles")
            return jsonify(error="failed to list nodes"), 503

    @app.post("/api/v1/readings")
    @require_device_token
    def ingest_reading():
        try:
            record = validate_reading(request.get_json(silent=True))
        except ValueError as exc:
            return jsonify(error=str(exc)), 400
        database, error = db_or_error()
        if error:
            return error
        try:
            result = database.readings.insert_one(record)
            record["_id"] = result.inserted_id
            turbidity_limit = os.getenv("TURBIDITY_OPERATING_LIMIT_NTU", "5.0").strip()
            flow_min = os.getenv("ACTIVE_FLOW_MIN_LPM", "").strip()
            try:
                turbidity_limit_value = float(turbidity_limit) if turbidity_limit else None
                flow_min_value = float(flow_min) if flow_min else None
            except ValueError:
                app.logger.error("Invalid operational threshold in environment configuration")
                return jsonify(error="invalid backend threshold configuration"), 500

            generated_alerts = evaluate_reading(record, turbidity_limit_value, flow_min_value)
            for alert in generated_alerts:
                # Keep one open alert per node and rule; repeated packets refresh it
                # instead of filling the queue with duplicates.
                initial_alert = {key: value for key, value in alert.items() if key not in {"message", "phase"}}
                initial_alert.update({"created_at": record["received_at"], "first_reading_id": str(result.inserted_id)})
                database.alerts.update_one(
                    {"node_id": alert["node_id"], "code": alert["code"], "status": "open"},
                    {"$set": {"message": alert["message"], "last_seen_at": record["received_at"], "latest_reading_id": str(result.inserted_id), "phase": alert.get("phase")},
                     "$setOnInsert": initial_alert,
                     "$inc": {"occurrences": 1}},
                    upsert=True,
                )
            return jsonify(ok=True, id=str(result.inserted_id), node_id=record["node_id"], timestamp=record["recorded_at"].isoformat(), alerts_generated=len(generated_alerts)), 201
        except PyMongoError:
            app.logger.exception("Failed to save telemetry")
            return jsonify(error="failed to save reading"), 503

    @app.get("/api/v1/nodes/<node_id>/latest")
    def latest_reading(node_id: str):
        database, error = db_or_error()
        if error:
            return error
        try:
            record = database.readings.find_one({"node_id": node_id}, sort=[("recorded_at", DESCENDING)])
            if record is None:
                return jsonify(error="no readings found", node_id=node_id), 404
            record["id"] = str(record.pop("_id"))
            record["recorded_at"] = record["recorded_at"].isoformat()
            record["received_at"] = record["received_at"].isoformat()
            return jsonify(record)
        except PyMongoError:
            app.logger.exception("Failed to fetch latest telemetry")
            return jsonify(error="failed to fetch reading"), 503

    @app.get("/api/v1/nodes/<node_id>/readings")
    def reading_history(node_id: str):
        raw_limit = request.args.get("limit", "100")
        try:
            limit = max(1, min(int(raw_limit), 1000))
        except ValueError:
            return jsonify(error="limit must be an integer between 1 and 1000"), 400
        database, error = db_or_error()
        if error:
            return error
        try:
            cursor = database.readings.find({"node_id": node_id}).sort("recorded_at", DESCENDING).limit(limit)
            records = []
            for record in cursor:
                record["id"] = str(record.pop("_id"))
                record["recorded_at"] = record["recorded_at"].isoformat()
                record["received_at"] = record["received_at"].isoformat()
                records.append(record)
            return jsonify(node_id=node_id, count=len(records), readings=records)
        except PyMongoError:
            app.logger.exception("Failed to fetch telemetry history")
            return jsonify(error="failed to fetch readings"), 503

    @app.get("/api/v1/nodes/<node_id>/runs/<run_id>/comparison")
    def compare_run(node_id: str, run_id: str):
        database, error = db_or_error()
        if error:
            return error
        try:
            inlet = database.readings.find_one(
                {"node_id": node_id, "run_id": run_id, "phase": "inlet"},
                sort=[("recorded_at", DESCENDING)],
            )
            outlet = database.readings.find_one(
                {"node_id": node_id, "run_id": run_id, "phase": "outlet"},
                sort=[("recorded_at", DESCENDING)],
            )
            if inlet is None or outlet is None:
                return jsonify(
                    node_id=node_id,
                    run_id=run_id,
                    status="waiting_for_pair",
                    received={"inlet": inlet is not None, "outlet": outlet is not None},
                )

            in_values = inlet["measurements"]
            out_values = outlet["measurements"]
            common = set(in_values) & set(out_values)
            comparisons = {}
            for field in sorted(common):
                if isinstance(in_values[field], (int, float)) and isinstance(out_values[field], (int, float)):
                    comparisons[field] = {
                        "inlet": in_values[field],
                        "outlet": out_values[field],
                        "change": round(out_values[field] - in_values[field], 4),
                    }

            turbidity_in = in_values.get("turbidity_ntu")
            turbidity_out = out_values.get("turbidity_ntu")
            turbidity_reduction_pct = None
            if isinstance(turbidity_in, (int, float)) and isinstance(turbidity_out, (int, float)) and turbidity_in > 0:
                turbidity_reduction_pct = round((turbidity_in - turbidity_out) / turbidity_in * 100, 2)

            return jsonify(
                node_id=node_id,
                run_id=run_id,
                status="paired",
                inlet_timestamp=inlet["recorded_at"].isoformat(),
                outlet_timestamp=outlet["recorded_at"].isoformat(),
                comparisons=comparisons,
                turbidity_reduction_pct=turbidity_reduction_pct,
                note="MQ-5 headspace readings are not a water-quality comparison or safety result.",
            )
        except PyMongoError:
            app.logger.exception("Failed to compare test run")
            return jsonify(error="failed to compare test run"), 503

    @app.get("/api/v1/nodes/<node_id>/alerts")
    def node_alerts(node_id: str):
        status = request.args.get("status", "open")
        if status not in ("open", "acknowledged", "resolved", "all"):
            return jsonify(error="status must be open, acknowledged, resolved, or all"), 400
        database, error = db_or_error()
        if error:
            return error
        query = {"node_id": node_id}
        if status != "all":
            query["status"] = status
        try:
            alerts = list(database.alerts.find(query).sort("last_seen_at", DESCENDING).limit(200))
            for alert in alerts:
                alert["id"] = str(alert.pop("_id"))
                for date_field in ("created_at", "last_seen_at"):
                    if alert.get(date_field):
                        alert[date_field] = alert[date_field].isoformat()
            return jsonify(node_id=node_id, count=len(alerts), alerts=alerts)
        except PyMongoError:
            app.logger.exception("Failed to fetch alerts")
            return jsonify(error="failed to fetch alerts"), 503

    @app.patch("/api/v1/alerts/<alert_id>")
    def update_alert(alert_id: str):
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or body.get("status") not in ("acknowledged", "resolved"):
            return jsonify(error="status must be acknowledged or resolved"), 400
        database, error = db_or_error()
        if error:
            return error
        try:
            from bson import ObjectId
            if not ObjectId.is_valid(alert_id):
                return jsonify(error="invalid alert id"), 400
            result = database.alerts.update_one(
                {"_id": ObjectId(alert_id), "status": {"$ne": "resolved"}},
                {"$set": {"status": body["status"], "updated_at": utc_now(), "operator_note": str(body.get("operator_note", ""))[:500]}},
            )
            if result.matched_count == 0:
                return jsonify(error="alert not found or already resolved"), 404
            return jsonify(ok=True, id=alert_id, status=body["status"])
        except PyMongoError:
            app.logger.exception("Failed to update alert")
            return jsonify(error="failed to update alert"), 503

    @app.get("/api/v1/nodes/<node_id>/telemetry-completeness")
    def telemetry_completeness(node_id: str):
        interval_text = os.getenv("EXPECTED_INTERVAL_SECONDS", "").strip()
        if not interval_text:
            return jsonify(node_id=node_id, status="not_configured", completeness_pct=None, note="Set the ESP32 reporting interval before calculating completeness.")
        try:
            interval_seconds = max(1, int(interval_text))
        except ValueError:
            return jsonify(error="EXPECTED_INTERVAL_SECONDS must be a positive integer"), 500
        database, error = db_or_error()
        if error:
            return error
        try:
            now = utc_now()
            window_start = now.timestamp() - 3600
            records = list(database.readings.find(
                {"node_id": node_id, "received_at": {"$gte": datetime.fromtimestamp(window_start, timezone.utc)}},
                {"received_at": 1},
            ).sort("received_at", 1))
            if not records:
                return jsonify(node_id=node_id, status="stale", completeness_pct=0, expected_interval_seconds=interval_seconds, received_packets=0, expected_packets=0)
            first_received_at = records[0]["received_at"]
            # PyMongo returns BSON dates as naive UTC datetimes by default.
            # Attach UTC before comparing with our timezone-aware `now` value.
            if first_received_at.tzinfo is None:
                first_received_at = first_received_at.replace(tzinfo=timezone.utc)
            elapsed = min(3600, max(interval_seconds, (now - first_received_at).total_seconds()))
            expected_packets = max(1, int(elapsed // interval_seconds))
            received_packets = len(records)
            completeness = round(min(100.0, received_packets / expected_packets * 100), 1)
            status = "good" if completeness >= 95 else "intermittent" if completeness >= 80 else "poor"
            return jsonify(node_id=node_id, status=status, completeness_pct=completeness, expected_interval_seconds=interval_seconds, received_packets=received_packets, expected_packets=expected_packets, window_seconds=int(elapsed))
        except PyMongoError:
            app.logger.exception("Failed to calculate telemetry completeness")
            return jsonify(error="failed to calculate telemetry completeness"), 503

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
