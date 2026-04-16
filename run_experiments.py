"""
Experimental results for the CS 5800 presentation — 5 scenarios comparing Greedy vs DP.
Run from the ROAM/ directory: python run_experiments.py
"""
import copy, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))

from backend.models import Activity, Config, compute_value, load_data
from backend.dijkstra import compute_all_pairs_shortest
from backend.dp_solver import dp_solve
from backend.greedy_solver import greedy_solve

DATA = "backend/data/vegas_activities.json"

def load():
    config, activities, travel_times = load_data(DATA)
    shortest = compute_all_pairs_shortest(travel_times)
    return config, activities, shortest

def run(label, config, activities, shortest):
    g = greedy_solve(activities, config, shortest)
    d = dp_solve(activities, config, shortest)
    gv, dv = g["total_value"], d["total_value"]
    improvement = ((dv - gv) / gv * 100) if gv > 0 else float("inf")
    print(f"\n{'='*60}")
    print(f"SCENARIO: {label}")
    print(f"  Budget: ${config.budget}  |  Score mode: {config.score_mode}  |  Group: {config.group_members}")
    print(f"  Greedy  → value={gv:.2f}, cost=${g['total_cost']}, activities={[a.name for a in g['selected']]}")
    print(f"  DP      → value={dv:.2f}, cost=${d['total_cost']}, activities={[a.name for a in d['selected']]}")
    if gv == dv:
        print(f"  Result: SAME (DP improvement: 0%)")
    else:
        print(f"  Result: DP is {improvement:.1f}% better than Greedy")
    return gv, dv

config, activities, shortest = load()

# ── Scenario 1: Default Las Vegas, full activity set, $500 budget ──────────
run("Default Las Vegas (15 activities, $500 budget, average score)",
    config, activities, shortest)

# ── Scenario 2: Tight budget ($100) ────────────────────────────────────────
c2 = copy.copy(config)
c2.budget = 100
run("Tight Budget ($100)", c2, activities, shortest)

# ── Scenario 3: Travel matters — only Downtown + Strip South activities ─────
travel_acts = [a for a in activities if a.location_id in ("downtown", "strip_south")]
run("Travel Matters (Downtown + Strip South only, $500)",
    config, travel_acts, shortest)

# ── Scenario 4: All free activities only ───────────────────────────────────
free_acts = [a for a in activities if a.cost == 0]
c4 = copy.copy(config)
c4.budget = 500
run("All Free Activities", c4, free_acts, shortest)

# ── Scenario 5: Min-max fairness mode ──────────────────────────────────────
c5 = copy.copy(config)
c5.score_mode = "min_max"
run("Min-Max Fairness Mode ($500 budget)", c5, activities, shortest)
