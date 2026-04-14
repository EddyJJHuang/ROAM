import pytest
import json
import tempfile
import os
from backend.models import Activity, Config, compute_value, slot_to_time, load_data

def test_activity_valid():
    act = Activity(
        id="A1",
        name="Museum",
        cost=20,
        start_slot=2,
        end_slot=4,
        location_id="L1",
        ratings={"Alice": 8, "Bob": 9}
    )
    assert act.id == "A1"
    assert act.name == "Museum"

def test_activity_invalid_slots():
    with pytest.raises(ValueError, match="must be < end_slot"):
        Activity("A1", "Museum", 20, 5, 2, "L1", {"Alice": 8})

def test_activity_invalid_cost():
    with pytest.raises(ValueError, match="must be >= 0"):
        Activity("A1", "Museum", -10, 2, 4, "L1", {"Alice": 8})

def test_activity_invalid_ratings():
    with pytest.raises(ValueError, match="must be an integer between 1 and 10"):
        Activity("A1", "Museum", 20, 2, 4, "L1", {"Alice": 11})

    with pytest.raises(ValueError, match="must be an integer between 1 and 10"):
        Activity("A1", "Museum", 20, 2, 4, "L1", {"Alice": 0})

def test_config_valid():
    cfg = Config(group_members=["Alice", "Bob"], score_mode="average")
    assert cfg.budget == 500
    assert cfg.day_start == "08:00"

def test_config_invalid_score_mode():
    with pytest.raises(ValueError, match="score_mode must be"):
        Config(group_members=["Alice", "Bob"], score_mode="invalid_mode")

def test_compute_value_average():
    act = Activity("A1", "Museum", 20, 2, 4, "L1", {"Alice": 8, "Bob": 9})
    cfg = Config(group_members=["Alice", "Bob"], score_mode="average")
    assert compute_value(act, cfg) == 8.5

def test_compute_value_min_max():
    act = Activity("A1", "Museum", 20, 2, 4, "L1", {"Alice": 8, "Bob": 5})
    cfg = Config(group_members=["Alice", "Bob"], score_mode="min_max")
    assert compute_value(act, cfg) == 5.0

def test_compute_value_missing_rating():
    act = Activity("A1", "Museum", 20, 2, 4, "L1", {"Alice": 8})
    cfg = Config(group_members=["Alice", "Bob"], score_mode="average")
    with pytest.raises(ValueError, match="Not all group members have rated"):
        compute_value(act, cfg)

def test_slot_to_time():
    cfg = Config(group_members=["Alice", "Bob"], score_mode="average", day_start="08:00", slot_minutes=30)
    assert slot_to_time(0, cfg) == "08:00"
    assert slot_to_time(1, cfg) == "08:30"
    assert slot_to_time(4, cfg) == "10:00"
    assert slot_to_time(32, cfg) == "00:00"

def test_load_data():
    data = {
        "config": {
            "group_members": ["Alice", "Bob"],
            "score_mode": "average"
        },
        "activities": [
            {
                "id": "A1",
                "name": "Museum",
                "cost": 20,
                "start_slot": 2,
                "end_slot": 4,
                "location_id": "L1",
                "ratings": {"Alice": 8, "Bob": 9}
            }
        ],
        "travel_times": {
            "L1": {"L2": 15}
        }
    }
    with tempfile.NamedTemporaryFile('w', delete=False) as f:
        json.dump(data, f)
        filepath = f.name
        
    try:
        config, activities, travel_times = load_data(filepath)
        assert config.group_members == ["Alice", "Bob"]
        assert len(activities) == 1
        assert activities[0].id == "A1"
        assert travel_times == {"L1": {"L2": 15}}
    finally:
        os.remove(filepath)

def test_load_data_invalid_member_ratings():
    data = {
        "config": {
            "group_members": ["Alice", "Bob"],
            "score_mode": "average"
        },
        "activities": [
            {
                "id": "A1",
                "name": "Museum",
                "cost": 20,
                "start_slot": 2,
                "end_slot": 4,
                "location_id": "L1",
                "ratings": {"Alice": 8, "Charlie": 9} # "Bob" is missing, "Charlie" is extra
            }
        ]
    }
    with tempfile.NamedTemporaryFile('w', delete=False) as f:
        json.dump(data, f)
        filepath = f.name
        
    try:
        with pytest.raises(ValueError, match="do not match group members"):
            load_data(filepath)
    finally:
        os.remove(filepath)
