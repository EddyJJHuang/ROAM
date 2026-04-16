# Note: imports use relative module names (not `backend.xxx`) for deployment compatibility
import math
import sys
from typing import Dict, Any, List

from models import Activity, Config, compute_value, slot_to_time

def dp_solve(activities: List[Activity], config: Config, shortest_times: Dict[str, Dict[str, int]]) -> Dict[str, Any]:
    """
    Implements a 2D dynamic programming solution for the activity selection problem
    with budget constraints. This calculates the optimal schedule logic.
    
    CLRS Concepts:
    - Difference from 0/1 Knapsack: The classic 0/1 Knapsack only has item and budget constraints.
      This problem has an additional TIME dimension constraint (Interval Scheduling).
      Items (activities) occupy specific time ranges, restricting available future choices.
    """
    # a. Sort activities by start_slot ascending
    sorted_acts = sorted(activities, key=lambda a: a.start_slot)
    
    # b. Budget discretization
    budget_units = config.budget // config.budget_granularity
    group_size = len(config.group_members)
    total_slots = config.total_slots
    
    # c. Initialize DP table (bottom-up approach)
    # dp[t][b] represents the maximum value obtainable starting from time slot t 
    # with b budget units remaining.
    # CLRS Overlapping Subproblems: Different combinations of activity choices can lead 
    # to the exact same remaining time slot `t` and remaining budget `b`. 
    # We memoize these states heavily to reduce redundant work.
    dp = [[0.0 for _ in range(budget_units + 1)] for _ in range(total_slots + 1)]
    
    # d. Initialize choice table
    choice = [[None for _ in range(budget_units + 1)] for _ in range(total_slots + 1)]
    
    states_explored = 0
    
    # e. Iterate from t = total_slots - 1 down to 0
    for t in range(total_slots - 1, -1, -1):
        for b in range(budget_units + 1):
            states_explored += 1
            
            # Default: do not pick any activity at time t
            dp[t][b] = dp[t+1][b]
            choice[t][b] = None
            
            # Evaluate all possible activities starting at the current time slot t
            for act in sorted_acts:
                if act.start_slot == t:
                    cost_units = (act.cost * group_size) // config.budget_granularity
                    
                    if b >= cost_units:
                        # Find the earliest available slot after the activity finishes.
                        # Travel time is implicitly handled later in transition validation.
                        next_t = act.end_slot
                        if next_t <= total_slots:
                            # CLRS Optimal Substructure: By selecting this activity, the remaining
                            # optimal problem only depends on the remaining time (next_t)
                            # and the remaining budget (b - cost_units).
                            candidate = compute_value(act, config) + dp[next_t][b - cost_units]
                            if candidate >= dp[t][b]:
                                dp[t][b] = candidate
                                choice[t][b] = act

    # f. Backtrack optimal path
    selected = []
    t = 0
    b = budget_units
    
    while t < total_slots:
        act = choice[t][b]
        if act is None:
            t += 1
        else:
            # Traveling validation when backtracking
            can_transition = True
            if selected:
                last_act = selected[-1]
                if last_act.location_id == act.location_id:
                    travel_time = 0
                else:
                    travel_time = shortest_times.get(last_act.location_id, {}).get(act.location_id, sys.maxsize)
                    
                required_gap = math.ceil(travel_time / config.slot_minutes)
                if last_act.end_slot + required_gap > act.start_slot:
                    can_transition = False
                    
            if can_transition:
                selected.append(act)
                b -= (act.cost * group_size) // config.budget_granularity
                t = act.end_slot
            else:
                t += 1

    # g. Format the return dictionary
    total_value = sum(compute_value(act, config) for act in selected)
    total_cost = sum((act.cost * group_size) for act in selected)
    budget_remaining = config.budget - total_cost
    
    timeline = []
    for act in selected:
        timeline.append({
            "activity": act,
            "start": slot_to_time(act.start_slot, config),
            "end": slot_to_time(act.end_slot, config)
        })
        
    return {
        "selected": selected,
        "total_value": float(total_value),
        "total_cost": total_cost,
        "budget_remaining": budget_remaining,
        "timeline": timeline,
        "dp_table_size": {"time_slots": total_slots, "budget_units": budget_units},
        "states_explored": states_explored
    }

