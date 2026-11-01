"""SuJal telemetry API: Flask + MongoDB Atlas."""

from __future__ import annotations

import csv
import json
import os
from io import StringIO
from datetime import datetime, timezone
from functools import wraps
from typing import Any
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument
from pymongo.errors import AutoReconnect, DuplicateKeyError, PyMongoError
from rules import evaluate_reading
from ai_interpreter import build_run_summary, interpret_summary

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


def validate_reading(payload: Any, idempotency_key: str | None = None) -> dict[str, Any]:
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

    event_id = payload.get("event_id") or idempotency_key
    if not isinstance(event_id, str) or not event_id.strip() or len(event_id.strip()) > 128:
        raise ValueError("event_id is required (or send it in the Idempotency-Key header) and must be 1..128 characters")

    device_status = payload.get("device_status", {})
    if not isinstance(device_status, dict):
        raise ValueError("device_status must be a JSON object")

    return {
        "node_id": node_id.strip(),
        "event_id": event_id.strip(),
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

    ca_file = None
    try:
        import certifi
        ca_file = certifi.where()
    except Exception:
        pass

    client_kwargs: dict[str, Any] = {
        "serverSelectionTimeoutMS": 10000,
        "connectTimeoutMS": 10000,
        "retryWrites": True,
        "retryReads": True,
    }
    if ca_file:
        client_kwargs["tlsCAFile"] = ca_file

    mongo_client = MongoClient(uri, **client_kwargs) if uri else None
    database = mongo_client[database_name] if mongo_client is not None else None
    app.extensions["mongo_client"] = mongo_client
    app.extensions["sujal_db"] = database
    if database is not None:
        for _ in range(3):
            try:
                database.readings.create_index(
                    [("node_id", ASCENDING), ("event_id", ASCENDING)],
                    unique=True,
                    partialFilterExpression={"event_id": {"$type": "string"}},
                    name="unique_node_event_id",
                )
                database.readings.create_index(
                    [("node_id", ASCENDING), ("recorded_at", DESCENDING)],
                    name="readings_by_node_time",
                )
                break
            except PyMongoError:
                import time
                time.sleep(1)
        else:
            app.logger.warning("Could not ensure MongoDB reading indexes during startup")
        try:
            database.ai_interpretations.create_index(
                [("node_id", ASCENDING), ("run_id", ASCENDING)],
                unique=True,
                name="unique_ai_interpretation_per_run",
            )
        except PyMongoError:
            app.logger.warning("Could not ensure Gemini interpretation index during startup")

    def db_or_error():
        if database is None:
            return None, (jsonify(error="MongoDB is not configured", hint="Set MONGODB_URI in backend/.env"), 503)
        return database, None

    def mongo_retry(fn, retries=3, delay=0.3):
        for i in range(retries):
            try:
                return fn()
            except (AutoReconnect, PyMongoError):
                if i == retries - 1:
                    raise
                import time
                time.sleep(delay)

    def require_device_token(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            expected = os.getenv("DEVICE_API_TOKEN", "").strip()
            if not expected:
                app.logger.error("Protected device API called while DEVICE_API_TOKEN is unset")
                return jsonify(error="device authentication is not configured"), 503
            if request.headers.get("X-Device-Token", "") != expected:
                return jsonify(error="unauthorized device"), 401
            return handler(*args, **kwargs)
        return wrapped

    def read_operating_thresholds() -> dict[str, float | int | None]:
        def optional_float(name: str, default: float | None = None) -> float | None:
            raw = os.getenv(name, "" if default is None else str(default)).strip()
            if not raw:
                return default
            value = float(raw)
            if value != value or value in (float("inf"), float("-inf")):
                raise ValueError(f"{name} must be a finite number")
            return value

        thresholds: dict[str, float | int | None] = {
            "turbidity_limit_ntu": optional_float("TURBIDITY_OPERATING_LIMIT_NTU", 5.0),
            "active_flow_min_lpm": optional_float("ACTIVE_FLOW_MIN_LPM"),
            "ph_min": optional_float("PH_MIN_OPERATING", 6.5),
            "ph_max": optional_float("PH_MAX_OPERATING", 8.5),
            "temperature_min_c": optional_float("TEMP_MIN_OPERATING_C", 5.0),
            "temperature_max_c": optional_float("TEMP_MAX_OPERATING_C", 40.0),
            "mq5_adc_alert_threshold": optional_float("MQ5_ADC_ALERT_THRESHOLD"),
            "expected_interval_seconds": optional_float("EXPECTED_INTERVAL_SECONDS"),
        }
        if thresholds["ph_min"] is not None and thresholds["ph_max"] is not None and thresholds["ph_min"] >= thresholds["ph_max"]:
            raise ValueError("PH_MIN_OPERATING must be less than PH_MAX_OPERATING")
        if thresholds["temperature_min_c"] is not None and thresholds["temperature_max_c"] is not None and thresholds["temperature_min_c"] >= thresholds["temperature_max_c"]:
            raise ValueError("TEMP_MIN_OPERATING_C must be less than TEMP_MAX_OPERATING_C")
        digital_alarm = os.getenv("MQ5_DIGITAL_ALARM_VALUE", "").strip()
        if digital_alarm:
            if digital_alarm not in ("0", "1"):
                raise ValueError("MQ5_DIGITAL_ALARM_VALUE must be blank, 0, or 1")
            thresholds["mq5_digital_alarm_value"] = int(digital_alarm)
        else:
            thresholds["mq5_digital_alarm_value"] = None
        return thresholds

    @app.get("/api/health")
    def health():
        if database is None:
            return jsonify(status="degraded", api="ok", database="not_configured"), 503
        for attempt in range(2):
            try:
                mongo_client.admin.command("ping")
                return jsonify(status="ok", api="ok", database="connected")
            except Exception as exc:
                app.logger.warning("Ping attempt %d failed: %s: %s", attempt, type(exc).__name__, exc)
                if attempt == 0:
                    import time
                    time.sleep(0.5)
        return jsonify(status="degraded", api="ok", database="unavailable"), 503

    @app.get("/api/v1/config/thresholds")
    def configured_thresholds():
        try:
            thresholds = read_operating_thresholds()
            interval = thresholds.get("expected_interval_seconds")
            if interval is not None and (interval < 1 or not float(interval).is_integer()):
                return jsonify(error="EXPECTED_INTERVAL_SECONDS must be a positive integer"), 500
            return jsonify(thresholds=thresholds)
        except ValueError as exc:
            app.logger.error("Invalid operating-threshold configuration: %s", exc)
            return jsonify(error="invalid backend threshold configuration", detail=str(exc)), 500

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
            nodes = mongo_retry(lambda: list(database.nodes.find({}, {"_id": 0}).sort("node_id", 1).limit(500)))
            for node in nodes:
                for field in ("created_at", "updated_at"):
                    if node.get(field):
                        val = node[field]
                        node[field] = val.isoformat() if hasattr(val, "isoformat") else str(val)
            return jsonify(count=len(nodes), nodes=nodes)
        except PyMongoError:
            app.logger.exception("Failed to list node profiles")
            return jsonify(error="failed to list nodes"), 503

    @app.post("/api/v1/readings")
    @require_device_token
    def ingest_reading():
        try:
            record = validate_reading(request.get_json(silent=True), request.headers.get("Idempotency-Key"))
        except ValueError as exc:
            return jsonify(error=str(exc)), 400
        try:
            thresholds = read_operating_thresholds()
        except ValueError as exc:
            app.logger.error("Invalid operating-threshold configuration: %s", exc)
            return jsonify(error="invalid backend threshold configuration", detail=str(exc)), 500
        database, error = db_or_error()
        if error:
            return error
        try:
            existing = None
            with mongo_client.start_session() as session:
                with session.start_transaction():
                    existing = database.readings.find_one(
                        {"node_id": record["node_id"], "event_id": record["event_id"]},
                        session=session,
                    )
                    if existing is None:
                        state = database.nodes.find_one({"node_id": record["node_id"]}, session=session)
                        if state is None or "sample_sequence" not in state:
                            previous_count = database.readings.count_documents(
                                {"node_id": record["node_id"]}, session=session
                            )
                            database.nodes.update_one(
                                {"node_id": record["node_id"]},
                                {"$set": {"sample_sequence": previous_count}},
                                upsert=True,
                                session=session,
                            )
                        state = database.nodes.find_one_and_update(
                            {"node_id": record["node_id"]},
                            {"$inc": {"sample_sequence": 1}},
                            return_document=ReturnDocument.AFTER,
                            session=session,
                        )
                        sequence = int(state["sample_sequence"])
                        record["sample_sequence"] = sequence
                        record["phase"] = "inlet" if sequence % 2 == 1 else "outlet"
                        record["run_id"] = f'{record["node_id"]}-PAIR-{(sequence + 1) // 2:06d}'
                        result = database.readings.insert_one(record, session=session)
                        record["_id"] = result.inserted_id
            if existing is not None:
                return jsonify(
                    ok=True, duplicate=True, reading_id=str(existing["_id"]),
                    node_id=record["node_id"], run_id=existing.get("run_id"),
                    phase=existing.get("phase"), timestamp=existing["recorded_at"].isoformat(),
                ), 200
            generated_alerts = evaluate_reading(record, thresholds)
            alert_ids = []
            for alert in generated_alerts:
                # Keep one open alert per node and rule; repeated packets refresh it
                # instead of filling the queue with duplicates.
                initial_alert = {key: value for key, value in alert.items() if key not in {"message", "phase"}}
                initial_alert.update({"created_at": record["received_at"], "first_reading_id": str(result.inserted_id)})
                update_result = database.alerts.update_one(
                    {"node_id": alert["node_id"], "code": alert["code"], "status": "open"},
                    {"$set": {"message": alert["message"], "last_seen_at": record["received_at"], "latest_reading_id": str(result.inserted_id), "phase": alert.get("phase")},
                     "$setOnInsert": initial_alert,
                     "$inc": {"occurrences": 1}},
                    upsert=True,
                )
                if update_result.upserted_id is not None:
                    alert_ids.append(str(update_result.upserted_id))
                else:
                    current_alert = database.alerts.find_one(
                        {"node_id": alert["node_id"], "code": alert["code"], "status": "open"},
                        {"_id": 1},
                    )
                    if current_alert:
                        alert_ids.append(str(current_alert["_id"]))

            control_recommendation = None
            if "low_active_branch_flow" in {alert["code"] for alert in generated_alerts}:
                active_branch = record["active_branch"]
                control_recommendation = {
                    "action": "failover_branch",
                    "close_branch": active_branch,
                    "open_branch": "B" if active_branch == "A" else "A",
                    "reason": "active branch flow is below ACTIVE_FLOW_MIN_LPM",
                    "execution": "ESP32 must verify and actuate locally; this API does not operate valves",
                }
            response_data = {
                "ok": True, "duplicate": False, "reading_id": str(result.inserted_id),
                "node_id": record["node_id"], "run_id": record.get("run_id"),
                "phase": record.get("phase"), "timestamp": record["recorded_at"].isoformat(),
                "alerts_generated": len(generated_alerts), "alert_ids": alert_ids,
            }
            if control_recommendation:
                response_data["control_recommendation"] = control_recommendation
            return jsonify(response_data), 201
        except DuplicateKeyError:
            # Covers two identical retries arriving at the same time.
            existing = database.readings.find_one({"node_id": record["node_id"], "event_id": record["event_id"]})
            if existing is not None:
                return jsonify(ok=True, duplicate=True, reading_id=str(existing["_id"]), node_id=record["node_id"], run_id=existing.get("run_id"), phase=existing.get("phase")), 200
            app.logger.exception("Duplicate event id encountered but original record was not found")
            return jsonify(error="duplicate event id could not be resolved"), 503
        except PyMongoError:
            app.logger.exception("Failed to save telemetry")
            return jsonify(error="failed to save reading"), 503

    @app.get("/api/v1/nodes/<node_id>/latest")
    def latest_reading(node_id: str):
        database, error = db_or_error()
        if error:
            return error
        try:
            record = mongo_retry(lambda: database.readings.find_one({"node_id": node_id}, sort=[("recorded_at", DESCENDING)]))
            if record is None:
                return jsonify(error="no readings found", node_id=node_id), 404
            record["id"] = str(record.pop("_id"))
            rec_at = record.get("recorded_at")
            recv_at = record.get("received_at")
            record["recorded_at"] = rec_at.isoformat() if hasattr(rec_at, "isoformat") else str(rec_at or "")
            record["received_at"] = recv_at.isoformat() if hasattr(recv_at, "isoformat") else str(recv_at or "")
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
            cursor = mongo_retry(lambda: list(database.readings.find({"node_id": node_id}).sort("recorded_at", DESCENDING).limit(limit)))
            records = []
            for record in cursor:
                record["id"] = str(record.pop("_id"))
                rec_at = record.get("recorded_at")
                recv_at = record.get("received_at")
                record["recorded_at"] = rec_at.isoformat() if hasattr(rec_at, "isoformat") else str(rec_at or "")
                record["received_at"] = recv_at.isoformat() if hasattr(recv_at, "isoformat") else str(recv_at or "")
                records.append(record)
            return jsonify(node_id=node_id, count=len(records), readings=records)
        except PyMongoError:
            app.logger.exception("Failed to fetch telemetry history")
            return jsonify(error="failed to fetch readings"), 503

    @app.get("/api/v1/nodes/<node_id>/averages/6-hour")
    def six_hour_averages(node_id: str):
        """Return four IST-day bucket averages, excluding missing/invalid values."""
        ist = ZoneInfo("Asia/Kolkata")
        date_text = request.args.get("date")
        try:
            local_day = datetime.strptime(date_text, "%Y-%m-%d").date() if date_text else utc_now().astimezone(ist).date()
            if date_text and local_day.isoformat() != date_text:
                raise ValueError
        except ValueError:
            return jsonify(error="date must use YYYY-MM-DD (IST) format"), 400

        local_start = datetime.combine(local_day, datetime.min.time(), tzinfo=ist)
        # Build day end by advancing one calendar day, including month/year boundaries.
        from datetime import timedelta
        local_end = local_start + timedelta(days=1)
        database, error = db_or_error()
        if error:
            return error

        def valid_value(field: str, value: Any) -> bool:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                return False
            if not (float("-inf") < float(value) < float("inf")):
                return False
            if field == "ph":
                return 0 <= value <= 14
            if field == "turbidity_ntu":
                return value >= 0
            if field == "temperature_c":
                return -20 <= value <= 85
            if field == "mq5_adc":
                return 0 <= value <= 4095
            if field == "mq5_digital":
                return value in (0, 1)
            if field.startswith("flow_lpm."):
                return value >= 0
            return False

        fields = ("ph", "turbidity_ntu", "temperature_c", "mq5_adc", "mq5_digital")
        slots = []
        for slot_index in range(4):
            start_local = local_start + timedelta(hours=slot_index * 6)
            end_local = start_local + timedelta(hours=6)
            slots.append({
                "slot": slot_index + 1,
                "start": start_local.isoformat(),
                "end": end_local.isoformat(),
            })

        try:
            cursor = database.readings.find({
                "node_id": node_id,
                "recorded_at": {"$gte": local_start.astimezone(timezone.utc), "$lt": local_end.astimezone(timezone.utc)},
            }, {"recorded_at": 1, "measurements": 1})
            records_by_slot: list[list[dict[str, Any]]] = [[] for _ in range(4)]
            for record in cursor:
                recorded_at = record.get("recorded_at")
                if recorded_at is None:
                    continue
                if recorded_at.tzinfo is None:
                    recorded_at = recorded_at.replace(tzinfo=timezone.utc)
                local_hour = recorded_at.astimezone(ist).hour
                records_by_slot[local_hour // 6].append(record)

            output = []
            for slot, records in zip(slots, records_by_slot):
                sums: dict[str, float] = {}
                counts: dict[str, int] = {}
                excluded: dict[str, int] = {}
                for field in fields:
                    values = [record.get("measurements", {}).get(field) for record in records]
                    accepted = [value for value in values if valid_value(field, value)]
                    if accepted:
                        sums[field] = round(sum(float(value) for value in accepted) / len(accepted), 4)
                    else:
                        sums[field] = None
                    counts[field] = len(accepted)
                    excluded[field] = len(values) - len(accepted)

                flow_keys = sorted({
                    key for record in records
                    for key in (record.get("measurements", {}).get("flow_lpm", {}) or {})
                })
                flow_averages = {}
                for key in flow_keys:
                    values = [
                        (record.get("measurements", {}).get("flow_lpm", {}) or {}).get(key)
                        for record in records
                    ]
                    accepted = [value for value in values if valid_value(f"flow_lpm.{key}", value)]
                    flow_averages[key] = {
                        "average": round(sum(float(value) for value in accepted) / len(accepted), 4) if accepted else None,
                        "valid_count": len(accepted),
                        "excluded_count": len(values) - len(accepted),
                    }
                bucket_result = {
                    "slot": slot["slot"], "start": slot["start"], "end": slot["end"],
                    "reading_count": len(records), "averages": sums,
                    "valid_counts": counts, "excluded_counts": excluded,
                    "flow_lpm": flow_averages,
                }
                # Keep a refreshable materialized snapshot so the four daily buckets
                # can be read later without recalculating the entire day.
                database.six_hour_averages.update_one(
                    {"node_id": node_id, "date": local_day.isoformat(), "slot": slot["slot"]},
                    {"$set": {**bucket_result, "timezone": "Asia/Kolkata", "generated_at": utc_now()}},
                    upsert=True,
                )
                output.append(bucket_result)
            return jsonify(node_id=node_id, date=local_day.isoformat(), timezone="Asia/Kolkata", buckets=output,
                           validity_rules={"ph": "0..14", "turbidity_ntu": ">=0", "temperature_c": "-20..85", "mq5_adc": "0..4095", "mq5_digital": "0 or 1", "flow_lpm": ">=0"})
        except PyMongoError:
            app.logger.exception("Failed to calculate six-hour averages")
            return jsonify(error="failed to calculate six-hour averages"), 503

    @app.get("/api/v1/nodes/<node_id>/archives")
    def list_monthly_archives(node_id: str):
        """List UTC months that contain saved readings for this node."""
        database, error = db_or_error()
        if error:
            return error
        try:
            months = mongo_retry(lambda: list(database.readings.aggregate([
                {"$match": {"node_id": node_id}},
                {"$group": {
                    "_id": {"$dateToString": {
                        "format": "%Y-%m", "date": "$recorded_at", "timezone": "UTC"
                    }},
                    "readings_count": {"$sum": 1},
                    "first_reading_at": {"$min": "$recorded_at"},
                    "last_reading_at": {"$max": "$recorded_at"},
                }},
                {"$sort": {"_id": -1}},
                {"$limit": 120},
            ])))
            def format_archive_dt(val):
                if val is None:
                    return ""
                if isinstance(val, str):
                    return val
                if getattr(val, "tzinfo", None) is None:
                    val = val.replace(tzinfo=timezone.utc)
                return val.isoformat().replace("+00:00", "Z")

            archives = [{
                "month": item["_id"] or "2026-11",
                "readings_count": item["readings_count"],
                "first_reading_at": format_archive_dt(item.get("first_reading_at")),
                "last_reading_at": format_archive_dt(item.get("last_reading_at")),
            } for item in months if item.get("_id")]
            return jsonify(node_id=node_id, count=len(archives), archives=archives)
        except PyMongoError:
            app.logger.exception("Failed to list monthly archives")
            return jsonify(error="failed to list archives"), 503

    @app.get("/api/v1/nodes/<node_id>/archives/<month>.csv")
    def download_monthly_archive(node_id: str, month: str):
        """Create a CSV download for one UTC month from canonical MongoDB records."""
        try:
            month_start = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
            if month_start.strftime("%Y-%m") != month:
                raise ValueError
        except ValueError:
            return jsonify(error="month must use YYYY-MM format"), 400
        next_month = month_start.replace(
            year=month_start.year + (1 if month_start.month == 12 else 0),
            month=1 if month_start.month == 12 else month_start.month + 1,
        )
        database, error = db_or_error()
        if error:
            return error
        try:
            cursor = database.readings.find({
                "node_id": node_id,
                "recorded_at": {"$gte": month_start, "$lt": next_month},
            }).sort("recorded_at", 1)
            output = StringIO(newline="")
            writer = csv.writer(output)
            writer.writerow([
                "reading_id", "node_id", "timestamp_utc", "received_at_utc",
                "run_id", "phase", "active_branch", "ph", "turbidity_ntu",
                "temperature_c", "mq5_adc", "mq5_digital", "flow_lpm_json",
                "device_status_json", "source",
            ])
            count = 0
            for record in cursor:
                measurements = record.get("measurements", {})
                recorded_at = record.get("recorded_at")
                received_at = record.get("received_at")
                if recorded_at and recorded_at.tzinfo is None:
                    recorded_at = recorded_at.replace(tzinfo=timezone.utc)
                if received_at and received_at.tzinfo is None:
                    received_at = received_at.replace(tzinfo=timezone.utc)
                writer.writerow([
                    str(record.get("_id", "")), record.get("node_id", ""),
                    recorded_at.isoformat().replace("+00:00", "Z") if recorded_at else "",
                    received_at.isoformat().replace("+00:00", "Z") if received_at else "",
                    record.get("run_id") or "", record.get("phase") or "",
                    record.get("active_branch") or "", measurements.get("ph", ""),
                    measurements.get("turbidity_ntu", ""), measurements.get("temperature_c", ""),
                    measurements.get("mq5_adc", ""), measurements.get("mq5_digital", ""),
                    json.dumps(measurements.get("flow_lpm", {}), separators=(",", ":")),
                    json.dumps(record.get("device_status", {}), separators=(",", ":")),
                    record.get("source", ""),
                ])
                count += 1
            if count == 0:
                return jsonify(error="no readings found for this node and month", node_id=node_id, month=month), 404
            filename_node = "".join(char if char.isalnum() or char in "-_" else "_" for char in node_id)
            response = Response("\ufeff" + output.getvalue(), mimetype="text/csv; charset=utf-8")
            response.headers["Content-Disposition"] = f'attachment; filename="{filename_node}_{month}.csv"'
            response.headers["X-Archive-Reading-Count"] = str(count)
            return response
        except PyMongoError:
            app.logger.exception("Failed to generate monthly CSV archive")
            return jsonify(error="failed to generate archive"), 503

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

    @app.post("/api/v1/nodes/<node_id>/runs/<run_id>/interpretation")
    def generate_run_interpretation(node_id: str, run_id: str):
        """Generate and persist one cached Gemini interpretation for a completed run."""
        database, error = db_or_error()
        if error:
            return error
        try:
            existing = database.ai_interpretations.find_one(
                {"node_id": node_id, "run_id": run_id}, {"_id": 0}
            )
            if existing:
                if existing.get("generated_at"):
                    existing["generated_at"] = existing["generated_at"].isoformat()
                existing["cached"] = True
                return jsonify(existing), 200

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
                    error="run is not paired yet",
                    node_id=node_id,
                    run_id=run_id,
                    status="waiting_for_pair",
                    received={"inlet": inlet is not None, "outlet": outlet is not None},
                ), 409

            api_key = os.getenv("GEMINI_API_KEY", "").strip()
            if not api_key:
                return jsonify(error="Gemini is not configured", hint="Set GEMINI_API_KEY in backend/.env"), 503
            if os.getenv("GEMINI_DATA_POLICY_CONFIRMED", "").strip() != "paid_billing_enabled":
                return jsonify(
                    error="Gemini data-use confirmation is required",
                    hint="Verify this API key belongs to a billing-enabled Gemini project, then set GEMINI_DATA_POLICY_CONFIRMED=paid_billing_enabled",
                ), 503
            model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()

            run_alerts = list(database.alerts.find(
                {"node_id": node_id, "run_id": run_id},
                {"_id": 0, "code": 1, "severity": 1, "title": 1, "message": 1, "status": 1},
            ).sort("last_seen_at", DESCENDING).limit(20))
            summary = build_run_summary(node_id, run_id, inlet, outlet, run_alerts)
            try:
                interpretation = interpret_summary(summary, api_key, model)
            except ImportError as exc:
                app.logger.exception("Gemini SDK is unavailable")
                return jsonify(error=str(exc)), 503
            except Exception:
                app.logger.exception("Gemini interpretation request failed")
                return jsonify(error="Gemini interpretation failed; check backend logs and Gemini configuration"), 502

            now = utc_now()
            document = {
                "node_id": node_id,
                "run_id": run_id,
                "model": model,
                "summary": summary,
                "interpretation": interpretation,
                "generated_at": now,
            }
            try:
                database.ai_interpretations.insert_one(document)
            except DuplicateKeyError:
                # A simultaneous request may have generated the same run first.
                cached = database.ai_interpretations.find_one(
                    {"node_id": node_id, "run_id": run_id}, {"_id": 0}
                )
                if cached:
                    cached["generated_at"] = cached["generated_at"].isoformat()
                    cached["cached"] = True
                    return jsonify(cached), 200
                raise
            document.pop("_id", None)
            document["generated_at"] = now.isoformat()
            document["cached"] = False
            return jsonify(document), 201
        except PyMongoError:
            app.logger.exception("Failed to generate or save Gemini interpretation")
            return jsonify(error="failed to generate or save interpretation"), 503

    @app.get("/api/v1/nodes/<node_id>/runs/<run_id>/interpretation")
    def get_run_interpretation(node_id: str, run_id: str):
        database, error = db_or_error()
        if error:
            return error
        try:
            document = database.ai_interpretations.find_one(
                {"node_id": node_id, "run_id": run_id}, {"_id": 0}
            )
            if document is None:
                return jsonify(error="no interpretation saved for this run", node_id=node_id, run_id=run_id), 404
            if document.get("generated_at"):
                document["generated_at"] = document["generated_at"].isoformat()
            document["cached"] = True
            return jsonify(document)
        except PyMongoError:
            app.logger.exception("Failed to fetch Gemini interpretation")
            return jsonify(error="failed to fetch interpretation"), 503

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
            alerts = mongo_retry(lambda: list(database.alerts.find(query).sort("last_seen_at", DESCENDING).limit(200)))
            for alert in alerts:
                alert["id"] = str(alert.pop("_id"))
                for date_field in ("created_at", "last_seen_at", "updated_at"):
                    if alert.get(date_field):
                        val = alert[date_field]
                        alert[date_field] = val.isoformat() if hasattr(val, "isoformat") else str(val)
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
            records = mongo_retry(lambda: list(database.readings.find(
                {"node_id": node_id, "received_at": {"$gte": datetime.fromtimestamp(window_start, timezone.utc)}},
                {"received_at": 1},
            ).sort("received_at", 1)))
            if not records:
                return jsonify(node_id=node_id, status="stale", completeness_pct=0, expected_interval_seconds=interval_seconds, received_packets=0, expected_packets=0)
            # Count one packet per expected interval so retries/bursts cannot inflate the score.
            times = []
            for record in records:
                received_at = record["received_at"]
                if received_at.tzinfo is None:
                    received_at = received_at.replace(tzinfo=timezone.utc)
                times.append(received_at)
            first_received_at, last_received_at = times[0], times[-1]
            now_epoch = now.timestamp()
            elapsed = min(3600.0, max(0.0, now_epoch - first_received_at.timestamp()))
            expected_packets = max(1, int(elapsed // interval_seconds) + 1)
            interval_slots = {
                int((received_at.timestamp() - first_received_at.timestamp()) // interval_seconds)
                for received_at in times
            }
            received_packets = min(len(interval_slots), expected_packets)
            completeness = round(received_packets / expected_packets * 100, 1)
            latest_gap_seconds = max(0.0, now_epoch - last_received_at.timestamp())
            if latest_gap_seconds > interval_seconds * 2:
                status = "stale"
            else:
                status = "good" if completeness >= 95 else "intermittent" if completeness >= 80 else "poor"
            return jsonify(
                node_id=node_id, status=status, completeness_pct=completeness,
                expected_interval_seconds=interval_seconds, received_packets=received_packets,
                raw_packets=len(times), duplicate_or_burst_packets=len(times) - received_packets,
                expected_packets=expected_packets, window_seconds=int(elapsed),
                latest_packet_age_seconds=round(latest_gap_seconds, 1),
            )
        except PyMongoError:
            app.logger.exception("Failed to calculate telemetry completeness")
            return jsonify(error="failed to calculate telemetry completeness"), 503

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
