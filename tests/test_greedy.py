import pytest
from backend.models import Activity, Config
from backend.greedy_solver import greedy_solve, has_conflict

def test_has_conflict():
    shortest_times = {"L1": {"L2": 30}, "L2": {"L1": 30}}
    act1 = Activity(id="A1", name="A", cost=10, start_slot=0, end_slot=2, location_id="L1", ratings={"Alice": 5})
    act2 = Activity(id="A2", name="B", cost=10, start_slot=3, end_slot=5, location_id="L2", ratings={"Alice": 5})
    
    # act1 ends at 2*30=60m. Trip L1->L2 is 30m. Arrival 90m.
    # act2 starts at 3*30=90m. Exactly on time -> no conflict.
    assert not has_conflict(act1, [act2], shortest_times, slot_minutes=30)
    assert not has_conflict(act2, [act1], shortest_times, slot_minutes=30)
    
    # Conflict: Clear timeline overlap
    act_overlap = Activity(id="A3", name="C", cost=10, start_slot=1, end_slot=4, location_id="L1", ratings={"Alice": 5})
    assert has_conflict(act1, [act_overlap], shortest_times, slot_minutes=30)
    
    # Conflict: Insufficient transit time
    act_tight = Activity(id="A4", name="D", cost=10, start_slot=2, end_slot=4, location_id="L2", ratings={"Alice": 5})
    # Arrival at L2 is 90 mins (end 60 + trip 30), but starting slot is 60 mins -> Late!
    assert has_conflict(act1, [act_tight], shortest_times, slot_minutes=30)


def test_greedy_solve_suboptimal_trap():
    """
    Validates that our knapsack constraint ensures Greedy gets "trapped" out of the optimal combination.
    This guarantees the Greedy algorithm produces the theoretical suboptimal counter-example specified in docstring.
    """
    config = Config(group_members=["Alice"], score_mode="average", budget=10, slot_minutes=30)
    shortest_times = {"L1": {"L1": 0}}
    
    # Act A: Costly but high value. cost=10, rating=9 -> ratio = 0.9
    # Act B: Cheap but average. cost=5, rating=5 -> ratio = 1.0
    act_a = Activity(id="A", name="Optimal Action", cost=10, start_slot=0, end_slot=2, location_id="L1", ratings={"Alice": 9})
    act_b = Activity(id="B", name="Greedy Trap", cost=5, start_slot=0, end_slot=2, location_id="L1", ratings={"Alice": 5})
    
    # Greedy will pick Act B due to its higher 1.0 ratio compared to Act A (0.9). 
    # Since they intersect in slots (0-2), Act A will then be excluded due to conflict.
    # Total derived value is 5, instead of optimal potential of 9.
    activities = [act_a, act_b]
    
    res = greedy_solve(activities, config, shortest_times)
    
    assert len(res["selected"]) == 1
    assert res["selected"][0].id == "B"
    assert res["total_value"] == 5.0
    assert res["budget_remaining"] == 5


def test_greedy_solve_timeline_sorting():
    config = Config(group_members=["Alice"], score_mode="average", budget=100, slot_minutes=30, day_start="08:00")
    shortest_times = {"L1": {"L1": 0}}
    
    # Ratio matters logically sorting:
    # A1 ratio = 10/10 = 1.0
    # A2 ratio = 10/5 = 2.0 (Gets picked naturally first, but happens chronologically later via output)
    act1 = Activity(id="A1", name="Early Act", cost=10, start_slot=0, end_slot=2, location_id="L1", ratings={"Alice": 10})
    act2 = Activity(id="A2", name="Later Act", cost=5, start_slot=4, end_slot=5, location_id="L1", ratings={"Alice": 10})
    
    res = greedy_solve([act1, act2], config, shortest_times)
    
    assert len(res["selected"]) == 2
    # Ensure chronology overrules greedy picking order in timeline extraction
    assert res["timeline"][0]["activity"].id == "A1"
    assert res["timeline"][1]["activity"].id == "A2"
    
    assert res["timeline"][0]["start"] == "08:00"
    assert res["timeline"][0]["end"] == "09:00"


def test_greedy_zero_cost():
    config = Config(group_members=["Alice"], score_mode="average", budget=5, slot_minutes=30)
    # Zero cost implies infinite ratio! Very high priority.
    act_free = Activity(id="F1", name="Free", cost=0, start_slot=0, end_slot=2, location_id="L1", ratings={"Alice": 5})
    act_cost = Activity(id="C1", name="Cost", cost=1, start_slot=0, end_slot=2, location_id="L1", ratings={"Alice": 10})
    shortest_times = {"L1": {"L1": 0}}
    
    res = greedy_solve([act_free, act_cost], config, shortest_times)
    
    assert len(res["selected"]) == 1
    assert res["selected"][0].id == "F1"
