"""Explainable operational rules for the SuJal demo.

These rules flag readings for operator review. They do not determine whether
water is safe for drinking or any other use.
"""

from typing import Any


def evaluate_reading(record: dict[str, Any], turbidity_limit_ntu: float | None,
                     active_flow_min_lpm: float | None) -> list[dict[str, Any]]:
    measurements = record.get("measurements", {})
    node_id = record["node_id"]
    alerts: list[dict[str, Any]] = []

    # The 5 NTU value in the mock UI is an illustrative, node-configured
    # operational threshold. It is deliberately named as such, not a safety limit.
    turbidity = measurements.get("turbidity_ntu")
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

    active_branch = record.get("active_branch")
    flow = measurements.get("flow_lpm", {})
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
