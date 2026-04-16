"""
ROAM Flask REST API
===================
Provides endpoints for the Ratings-Optimized Activity Manager system.
Runs both greedy and DP solvers and returns comparison results to the
React frontend.
"""
# Note: imports use relative module names (not `backend.xxx`) for deployment compatibility
import os
import json
import traceback
from dataclasses import asdict

from flask import Flask, request, jsonify
from flask_cors import CORS

from models import Activity, Config, load_data, slot_to_time, compute_value
from dijkstra import compute_all_pairs_shortest
from greedy_solver import greedy_solve
from dp_solver import dp_solve

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# Data path – resolve relative to this file so it works regardless of cwd
# ---------------------------------------------------------------------------
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DEFAULT_DATA_PATH = os.path.join(DATA_DIR, "vegas_activities.json")

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _activity_to_dict(act: Activity, config: Config) -> dict:
    """Serialize an Activity dataclass into a JSON-friendly dict with
    human-readable time strings."""
    return {
        "id": act.id,
        "name": act.name,
        "cost": act.cost,
        "start_slot": act.start_slot,
        "end_slot": act.end_slot,
        "start_time": slot_to_time(act.start_slot, config),
        "end_time": slot_to_time(act.end_slot, config),
        "time_range": f"{slot_to_time(act.start_slot, config)}-{slot_to_time(act.end_slot, config)}",
        "location_id": act.location_id,
        "ratings": act.ratings,
    }


def _format_solver_result(result: dict, config: Config) -> dict:
    """Convert a solver result dict (from greedy_solve / dp_solve) into a
    JSON-serializable format with readable time strings."""
    formatted = {
        "selected": [_activity_to_dict(a, config) for a in result["selected"]],
        "total_value": result["total_value"],
        "total_cost": result["total_cost"],
        "budget_remaining": result["budget_remaining"],
        "timeline": [
            {
                "activity": _activity_to_dict(entry["activity"], config),
                "start": entry["start"],
                "end": entry["end"],
            }
            for entry in result["timeline"]
        ],
    }
    # DP solver includes extra metadata
    if "dp_table_size" in result:
        formatted["dp_table_size"] = result["dp_table_size"]
        formatted["states_explored"] = result["states_explored"]
    return formatted


def _build_comparison(greedy_result: dict, dp_result: dict) -> dict:
    """Build a comparison summary between greedy and optimal results."""
    greedy_ids = {a.id for a in greedy_result["selected"]}
    dp_ids = {a.id for a in dp_result["selected"]}
    return {
        "value_difference": round(dp_result["total_value"] - greedy_result["total_value"], 4),
        "greedy_is_optimal": abs(dp_result["total_value"] - greedy_result["total_value"]) < 1e-9,
        "activities_only_in_greedy": sorted(greedy_ids - dp_ids),
        "activities_only_in_optimal": sorted(dp_ids - greedy_ids),
    }


def _apply_ratings(activities: list[Activity], ratings: dict, group_members: list[str]) -> list[Activity]:
    """Return a *new* list of Activity objects whose .ratings dicts have been
    replaced with the caller-supplied ratings matrix.

    ``ratings`` is shaped as  { member: { activity_id: score, … }, … }
    """
    updated = []
    for act in activities:
        new_ratings: dict[str, int] = {}
        for member in group_members:
            member_ratings = ratings.get(member)
            if member_ratings is None:
                raise ValueError(f"Missing ratings for member '{member}'")
            score = member_ratings.get(act.id)
            if score is None:
                raise ValueError(
                    f"Member '{member}' has no rating for activity '{act.id}'"
                )
            new_ratings[member] = int(score)
        updated.append(
            Activity(
                id=act.id,
                name=act.name,
                cost=act.cost,
                start_slot=act.start_slot,
                end_slot=act.end_slot,
                location_id=act.location_id,
                ratings=new_ratings,
            )
        )
    return updated


def _run_solvers(activities: list[Activity], config: Config, travel_times: dict) -> dict:
    """Run both solvers on the given input and return a unified response body."""
    shortest_times = compute_all_pairs_shortest(travel_times)

    greedy_result = greedy_solve(activities, config, shortest_times)
    dp_result = dp_solve(activities, config, shortest_times)

    return {
        "greedy": _format_solver_result(greedy_result, config),
        "optimal": _format_solver_result(dp_result, config),
        "comparison": _build_comparison(greedy_result, dp_result),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/activities", methods=["GET"])
def get_activities():
    """
    GET /api/activities
    Returns the preset Las Vegas activities, config, and travel time matrix.
    """
    try:
        config, activities, travel_times = load_data(DEFAULT_DATA_PATH)
        return jsonify({
            "config": asdict(config),
            "activities": [_activity_to_dict(a, config) for a in activities],
            "travel_times": travel_times,
        })
    except FileNotFoundError:
        return jsonify({"error": "Default activity data file not found"}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Failed to load activities: {str(e)}"}), 500


@app.route("/api/solve", methods=["POST"])
def solve():
    """
    POST /api/solve
    Runs both greedy and DP solvers on the preset (or supplied) activities
    with the caller's ratings and optional config overrides.

    Expected JSON body:
      {
        "config": { "group_members": [...], ... },
        "ratings": { "Alice": {"sphere": 9, ...}, ... },
        "activities": [...]          // optional
      }
    """
    try:
        body = request.get_json(force=True)
        if body is None:
            return jsonify({"error": "Request body must be valid JSON"}), 400

        # ---- Config -------------------------------------------------------
        config_input = body.get("config")
        if config_input is None:
            return jsonify({"error": "Missing 'config' in request body"}), 400

        group_members = config_input.get("group_members")
        if not group_members or not isinstance(group_members, list):
            return jsonify({"error": "'config.group_members' is required and must be a non-empty list"}), 400

        # ---- Ratings ------------------------------------------------------
        ratings = body.get("ratings")
        if not ratings or not isinstance(ratings, dict):
            return jsonify({"error": "'ratings' is required and must be an object mapping members to activity scores"}), 400

        # ---- Activities & travel times ------------------------------------
        if "activities" in body and body["activities"]:
            # Caller supplies custom activity list inline
            raw_acts = body["activities"]
            activities = [Activity(**a) for a in raw_acts]
            travel_times = body.get("travel_times", {})
        else:
            # Fall back to default preset data
            _, activities, travel_times = load_data(DEFAULT_DATA_PATH)

        # ---- Build effective Config (merge defaults with overrides) --------
        default_config, _, _ = load_data(DEFAULT_DATA_PATH)
        config = Config(
            group_members=group_members,
            score_mode=config_input.get("score_mode", "average"),
            day_start=config_input.get("day_start", default_config.day_start),
            day_end=config_input.get("day_end", default_config.day_end),
            slot_minutes=config_input.get("slot_minutes", default_config.slot_minutes),
            total_slots=config_input.get("total_slots", default_config.total_slots),
            budget=config_input.get("budget", default_config.budget),
            budget_granularity=config_input.get("budget_granularity", default_config.budget_granularity),
        )

        # ---- Apply caller ratings to activities ---------------------------
        activities = _apply_ratings(activities, ratings, group_members)

        # ---- Solve --------------------------------------------------------
        response = _run_solvers(activities, config, travel_times)
        return jsonify(response)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@app.route("/api/custom", methods=["POST"])
def custom_solve():
    """
    POST /api/custom
    Accepts a complete user-defined dataset (same format as vegas_activities.json)
    and runs both solvers.

    Expected JSON body:
      {
        "config": { "group_members": [...], "score_mode": "average", ... },
        "activities": [ { "id": "...", "name": "...", ... }, ... ],
        "travel_times": { "loc_a": { "loc_b": 10, ... }, ... }
      }
    """
    try:
        body = request.get_json(force=True)
        if body is None:
            return jsonify({"error": "Request body must be valid JSON"}), 400

        # ---- Validate required top-level keys -----------------------------
        for key in ("config", "activities", "travel_times"):
            if key not in body:
                return jsonify({"error": f"Missing required key: '{key}'"}), 400

        config_data = body["config"]
        if not config_data.get("group_members"):
            return jsonify({"error": "'config.group_members' is required"}), 400

        config = Config(**config_data)

        raw_acts = body["activities"]
        if not raw_acts:
            return jsonify({"error": "'activities' must be a non-empty list"}), 400
        activities = [Activity(**a) for a in raw_acts]

        travel_times = body["travel_times"]

        # ---- Solve --------------------------------------------------------
        response = _run_solvers(activities, config, travel_times)
        return jsonify(response)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
