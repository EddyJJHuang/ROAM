from typing import List, Dict, Any

from backend.models import Activity, Config, compute_value, slot_to_time
from backend.dijkstra import is_transition_feasible

def has_conflict(new_act: Activity, selected: List[Activity], shortest_times: Dict[str, Dict[str, int]], slot_minutes: int) -> bool:
    """
    Checks if a newly proposed activity conflicts with an existing schedule.
    A conflict occurs if time ranges overlap or travel time between consecutive 
    activities makes the transition impossible.
    """
    for sel_act in selected:
        # Check pure time overlap: 
        # Intersection occurs if the maximum of their start slots is strictly less than the minimum of their end slots.
        if max(new_act.start_slot, sel_act.start_slot) < min(new_act.end_slot, sel_act.end_slot):
            return True
        
        # If new_act is scheduled before sel_act, check if travel transition from new_act -> sel_act is viable
        if new_act.end_slot <= sel_act.start_slot:
            if not is_transition_feasible(new_act, sel_act, shortest_times, slot_minutes):
                return True
                
        # If sel_act is scheduled before new_act, check transition from sel_act -> new_act 
        if sel_act.end_slot <= new_act.start_slot:
            if not is_transition_feasible(sel_act, new_act, shortest_times, slot_minutes):
                return True
                
    return False

def greedy_solve(activities: List[Activity], config: Config, shortest_times: Dict[str, Dict[str, int]]) -> Dict[str, Any]:
    """
    Implements a greedy baseline algorithm for scheduling activities.
    It sorts available activities by their value/cost ratio in descending order.
    
    Why this strategy is NOT strictly optimal:
    -------------------------------------------
    In CLRS Chapter 16.1 (Activity-Selection Problem), the canonical greedy choice 
    (selecting the earliest finish time) yields an optimal result exclusively for 
    unweighted intervals, maximizing the total count.
    
    In ROAM, activities have varied "values" (from group ratings) and specific "costs".
    This essentially bridges the Interval Scheduling problem with the 0-1 Knapsack problem.
    Sorting by `value/cost` ratio is a heuristic native to the Fractional Knapsack Problem,
    but it fails to guarantee optimality for integer constraints (0-1 Knapsack) compounded
    by overlap bounds.
    
    Counter-example: 
    Let Budget = $10, and we have two activities that share the same time block (they overlap):
    - Activity A: value=9, cost=10 (ratio = 0.9)
    - Activity B: value=5, cost=5  (ratio = 1.0)
    
    The Greedy Solver prioritizes ratio, picking Activity B first. It consumes $5 and occupies the slot.
    It then examines Activity A but rejects it due to the time conflict. Final value = 5.
    However, the optimal solution algorithm (like DP) would forgo Activity B and pick Activity A,
    yielding a higher final value = 9 within the $10 budget limit.
    """
    group_size = len(config.group_members)
    
    # Cache computed values and ratios for comparison
    act_values = {}
    act_ratios = {}
    for act in activities:
        val = compute_value(act, config)
        act_values[act.id] = val
        if act.cost == 0:
            ratio = float('inf')  # Free high-value activities get maximum priority
        else:
            ratio = val / act.cost
        act_ratios[act.id] = ratio
        
    # Standard Greedy choice: Sort by ratio descending
    sorted_acts = sorted(activities, key=lambda x: act_ratios[x.id], reverse=True)
    
    selected = []
    total_value = 0.0
    total_cost = 0
    remaining_budget = config.budget
    
    for act in sorted_acts:
        act_total_cost = act.cost * group_size
        
        # Condition 1: Check if enough budget left
        if act_total_cost <= remaining_budget:
            # Condition 2: Check for any overlapping timeline or impossible transit boundaries
            if not has_conflict(act, selected, shortest_times, config.slot_minutes):
                selected.append(act)
                total_value += act_values[act.id]
                total_cost += act_total_cost
                remaining_budget -= act_total_cost
                
    # Format the timeline chronologically for the return block
    selected.sort(key=lambda x: x.start_slot)
    
    timeline = []
    for act in selected:
        timeline.append({
            "activity": act,
            "start": slot_to_time(act.start_slot, config),
            "end": slot_to_time(act.end_slot, config)
        })
        
    return {
        "selected": selected,
        "total_value": total_value,
        "total_cost": total_cost,
        "budget_remaining": remaining_budget,
        "timeline": timeline
    }
