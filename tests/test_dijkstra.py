import pytest
from backend.dijkstra import dijkstra, compute_all_pairs_shortest, is_transition_feasible
from backend.models import Activity

def test_dijkstra_indirect_path():
    # Test case demonstrating indirect routes being significantly faster than disjoint direct connections.
    graph = {
        "A": {"B": 50, "C": 10},
        "B": {"E": 10},
        "C": {"D": 10},
        "D": {"B": 10},
        "E": {}
    }
    # Path A -> B directly is 50. 
    # Indirect Path A -> C (10) -> D (10) -> B (10) = 30.
    distances = dijkstra(graph, "A")
    assert distances["A"] == 0
    assert distances["B"] == 30
    assert distances["C"] == 10
    assert distances["D"] == 20
    assert distances["E"] == 40


def test_dijkstra_self_distance():
    graph = {
        "A": {"A": 10, "B": 20},
        "B": {"A": 20, "B": 15}
    }
    # Shortest travel time to self should always be 0 regardless of looped edges
    distances = dijkstra(graph, "A")
    assert distances["A"] == 0
    assert distances["B"] == 20


def test_dijkstra_unreachable_node():
    graph = {
         "A": {"B": 5},
         "C": {"D": 5}
    }
    distances = dijkstra(graph, "A")
    assert "C" not in distances
    assert "D" not in distances


def test_compute_all_pairs():
    graph = {
        "A": {"B": 50, "C": 10},
        "B": {"A": 50},
        "C": {"B": 10}
    }
    all_pairs = compute_all_pairs_shortest(graph)
    assert all_pairs["A"]["B"] == 20  # A -> C -> B
    assert all_pairs["C"]["B"] == 10  # C -> B directly
    assert all_pairs["B"]["C"] == 60  # B -> A -> C
    assert all_pairs["B"]["A"] == 50  # B -> A directly


def test_is_transition_feasible_just_in_time():
    shortest_times = {
        "strip_north": {"downtown": 30}
    }
    # Activity A runs from slot 0 to 2. Under a 30m block size, it ends exactly at 60 mins.
    act_a = Activity(id="A", name="A", cost=10, start_slot=0, end_slot=2, location_id="strip_north", ratings={"Alice": 10})
    # Activity B begins at slot 3. It begins exactly at 90 mins.
    act_b = Activity(id="B", name="B", cost=20, start_slot=3, end_slot=5, location_id="downtown", ratings={"Alice": 10})
    
    # 60 + 30m travel time = 90 mins == Activity B start time
    assert is_transition_feasible(act_a, act_b, shortest_times, slot_minutes=30) is True


def test_is_transition_feasible_one_minute_late():
    shortest_times = {
        "strip_north": {"downtown": 31}
    }
    act_a = Activity(id="A", name="A", cost=10, start_slot=0, end_slot=2, location_id="strip_north", ratings={"Alice": 10})
    act_b = Activity(id="B", name="B", cost=20, start_slot=3, end_slot=5, location_id="downtown", ratings={"Alice": 10})
    
    # 60 + 31m travel time = 91 mins > 90 min max
    assert is_transition_feasible(act_a, act_b, shortest_times, slot_minutes=30) is False


def test_is_transition_feasible_same_location():
    shortest_times = {
        "strip_north": {"strip_north": 15}  # This edge should be ignored. Distance == 0 since locations are identical
    }
    act_a = Activity(id="A", name="A", cost=10, start_slot=0, end_slot=2, location_id="strip_north", ratings={"Alice": 10})
    # Tight transition exactly mapping out
    act_b = Activity(id="B", name="B", cost=20, start_slot=2, end_slot=4, location_id="strip_north", ratings={"Alice": 10})
    
    assert is_transition_feasible(act_a, act_b, shortest_times, slot_minutes=30) is True


def test_is_transition_feasible_unreachable():
    shortest_times = {
         "strip_north": {"strip_south": 20}
    }
    act_a = Activity(id="A", name="A", cost=10, start_slot=0, end_slot=2, location_id="strip_north", ratings={"Alice": 10})
    act_unreachable = Activity(id="D", name="D", cost=20, start_slot=6, end_slot=8, location_id="off_strip", ratings={"Alice": 10})
    
    # Trying to lookup 'off_strip' which does not exist in graph path weights -> assumes sys.maxsize
    assert is_transition_feasible(act_a, act_unreachable, shortest_times, slot_minutes=30) is False
