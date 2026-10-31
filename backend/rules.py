"""Explainable operational rules for the SuJal demo.

These rules flag readings for operator review. They do not determine whether
water is safe for drinking or any other use.
"""

from typing import Any


def evaluate_reading(record: dict[str, Any], thresholds: dict[str, float | int | None]) -> list[dict[str, Any]]:
    measurements = record.get("measurements", {})
    node_id = record["node_id"]
    alerts: list[dict[str, Any]] = []

    # These are configurable operating/demo limits, not water safety limits.
    turbidity = measurements.get("turbidity_ntu")
    turbidity_limit_ntu = thresholds["turbidity_limit_ntu"]
    if turbidity_limit_ntu is not None and turbidity is not None and turbidity > turbidity_limit_ntu:
        alerts.append({
            "code": "turbidity_excursion",
            "category": "measurement",
            "severity": "high",
            "title": "Turbidity above configured operating limit",
            "message": f"{turbidity:g} NTU exceeds this node's configured {turbidity_limit_ntu:g} NTU operating limit.",
            "node_id": node_id,
            "run_id": record.get("run_id"),
            "phase": record.get("phase"),
            "reading_id": str(record.get("_id", "")),
            "status": "open",
            "safety_assessment": False,
        })

    ph = measurements.get("ph")
    ph_min = thresholds["ph_min"]
    ph_max = thresholds["ph_max"]
    if ph is not None and ph_min is not None and ph < ph_min:
        alerts.append({
            "code": "ph_below_operating_range", "category": "measurement", "severity": "warning",
            "title": "pH below configured operating range",
            "message": f"pH {ph:g} is below this node's configured {ph_min:g} operating minimum.",
            "node_id": node_id, "run_id": record.get("run_id"), "phase": record.get("phase"),
            "reading_id": str(record.get("_id", "")), "status": "open", "safety_assessment": False,
        })
    if ph is not None and ph_max is not None and ph > ph_max:
        alerts.append({
            "code": "ph_above_operating_range", "category": "measurement", "severity": "warning",
            "title": "pH above configured operating range",
            "message": f"pH {ph:g} is above this node's configured {ph_max:g} operating maximum.",
            "node_id": node_id, "run_id": record.get("run_id"), "phase": record.get("phase"),
            "reading_id": str(record.get("_id", "")), "status": "open", "safety_assessment": False,
        })

    temperature = measurements.get("temperature_c")
    temperature_min = thresholds["temperature_min_c"]
    temperature_max = thresholds["temperature_max_c"]
    if temperature is not None and temperature_min is not None and temperature < temperature_min:
        alerts.append({
            "code": "temperature_below_operating_range", "category": "measurement", "severity": "warning",
            "title": "Temperature below configured operating range",
            "message": f"Temperature {temperature:g} °C is below this node's configured {temperature_min:g} °C operating minimum.",
            "node_id": node_id, "run_id": record.get("run_id"), "phase": record.get("phase"),
            "reading_id": str(record.get("_id", "")), "status": "open", "safety_assessment": False,
        })
    if temperature is not None and temperature_max is not None and temperature > temperature_max:
        alerts.append({
            "code": "temperature_above_operating_range", "category": "measurement", "severity": "warning",
            "title": "Temperature above configured operating range",
            "message": f"Temperature {temperature:g} °C is above this node's configured {temperature_max:g} °C operating maximum.",
            "node_id": node_id, "run_id": record.get("run_id"), "phase": record.get("phase"),
            "reading_id": str(record.get("_id", "")), "status": "open", "safety_assessment": False,
        })

    mq5_adc = measurements.get("mq5_adc")
    mq5_threshold = thresholds["mq5_adc_alert_threshold"]
    if mq5_adc is not None and mq5_threshold is not None and mq5_adc >= mq5_threshold:
        alerts.append({
            "code": "mq5_headspace_signal_high", "category": "environmental_sensor", "severity": "warning",
            "title": "MQ-5 headspace signal above configured threshold",
            "message": f"MQ-5 ADC reading {mq5_adc:g} reached the configured signal threshold {mq5_threshold:g}; this is an uncalibrated headspace signal, not a gas concentration or water-quality result.",
            "node_id": node_id, "run_id": record.get("run_id"), "phase": record.get("phase"),
            "reading_id": str(record.get("_id", "")), "status": "open", "safety_assessment": False,
        })
    mq5_digital = measurements.get("mq5_digital")
    mq5_digital_alarm = thresholds["mq5_digital_alarm_value"]
    if mq5_digital is not None and mq5_digital_alarm is not None and mq5_digital == mq5_digital_alarm:
        alerts.append({
            "code": "mq5_digital_alarm", "category": "environmental_sensor", "severity": "warning",
            "title": "MQ-5 module digital alarm output active",
            "message": f"MQ-5 digital output matched the configured alarm value {mq5_digital_alarm}; this is a headspace module signal, not a gas concentration or water-quality result.",
            "node_id": node_id, "run_id": record.get("run_id"), "phase": record.get("phase"),
            "reading_id": str(record.get("_id", "")), "status": "open", "safety_assessment": False,
        })

    active_branch = record.get("active_branch")
    flow = measurements.get("flow_lpm", {})
    active_flow_min_lpm = thresholds["active_flow_min_lpm"]
    if active_flow_min_lpm is not None and active_branch in ("A", "B"):
        branch_flow = flow.get(f"branch_{active_branch.lower()}")
        if branch_flow is not None and branch_flow < active_flow_min_lpm:
            alerts.append({
                "code": "low_active_branch_flow",
                "category": "system",
                "severity": "high",
                "title": "Low flow in active branch",
                "message": f"Branch {active_branch} flow is {branch_flow:g} L/min, below the configured {active_flow_min_lpm:g} L/min operating threshold. Check the filter, pump, and flow sensor.",
                "node_id": node_id,
                "run_id": record.get("run_id"),
                "phase": record.get("phase"),
                "reading_id": str(record.get("_id", "")),
                "status": "open",
                "safety_assessment": False,
            })

    expected = ("ph", "turbidity_ntu", "temperature_c")
    missing = [field for field in expected if measurements.get(field) is None]
    if missing:
        alerts.append({
            "code": "incomplete_measurement_packet",
            "category": "data_quality",
            "severity": "warning",
            "title": "Incomplete sensor packet",
            "message": "Missing expected readings: " + ", ".join(missing),
            "node_id": node_id,
            "run_id": record.get("run_id"),
            "phase": record.get("phase"),
            "reading_id": str(record.get("_id", "")),
            "status": "open",
            "safety_assessment": False,
        })

    return alerts
