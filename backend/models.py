from __future__ import annotations
import json
from dataclasses import dataclass
from typing import Any

@dataclass
class Activity:
    """
    Represents an activity in the ROAM itinerary optimization system.
    """
    id: str
    name: str
    cost: int
    start_slot: int
    end_slot: int
    location_id: str
    ratings: dict[str, int]

    def __post_init__(self) -> None:
        """Validates the activity attributes after initialization."""
        if self.start_slot >= self.end_slot:
            raise ValueError(f"start_slot ({self.start_slot}) must be < end_slot ({self.end_slot})")
        if self.cost < 0:
            raise ValueError(f"cost ({self.cost}) must be >= 0")
        for member, rating in self.ratings.items():
            if not isinstance(rating, int) or not (1 <= rating <= 10):
                raise ValueError(f"rating for {member} must be an integer between 1 and 10, got {rating}")


@dataclass
class Config:
    """
    Configuration for the ROAM itinerary optimization system.
    """
    group_members: list[str]
    score_mode: str
    day_start: str = "08:00"
    day_end: str = "24:00"
    slot_minutes: int = 30
    total_slots: int = 32
    budget: int = 500
    budget_granularity: int = 10

    def __post_init__(self) -> None:
        """Validates the config attributes after initialization."""
        if self.score_mode not in ("average", "min_max"):
            raise ValueError('score_mode must be "average" or "min_max"')


def compute_value(activity: Activity, config: Config) -> float:
    """
    Computes the value score of an activity based on the group configuration.
    
    Args:
        activity: The activity to evaluate.
        config: The configuration containing group members and score mode.
        
    Returns:
        The computed score as a float.
    """
    ratings = [activity.ratings.get(m) for m in config.group_members]
    if any(r is None for r in ratings):
        raise ValueError(f"Not all group members have rated activity {activity.id}")
        
    if config.score_mode == "average":
        return sum(ratings) / len(ratings)
    elif config.score_mode == "min_max":
        return float(min(ratings))
    else:
        raise ValueError(f"Unknown score mode: {config.score_mode}")


def slot_to_time(slot: int, config: Config) -> str:
    """
    Converts a slot index to a readable time string based on the configuration.
    
    Args:
        slot: The slot index (e.g., 0 for start of day).
        config: The configuration containing day_start and slot_minutes.
        
    Returns:
        A formatted time string like "HH:MM".
    """
    start_hour, start_minute = map(int, config.day_start.split(':'))
    total_minutes = start_hour * 60 + start_minute + slot * config.slot_minutes
    
    hour = (total_minutes // 60) % 24
    minute = total_minutes % 60
    return f"{hour:02d}:{minute:02d}"


def load_data(filepath: str) -> tuple[Config, list[Activity], dict[str, dict[str, int]]]:
    """
    Loads configuration, activities, and travel time matrix from a JSON file.
    
    Args:
        filepath: Path to the JSON data file.
        
    Returns:
        A tuple containing:
        - Config object
        - List of Activity objects
        - Travel time matrix (dict of dicts)
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    config_data = data.get('config', {})
    config = Config(**config_data)
    
    activities_data = data.get('activities', [])
    activities = []
    for act_data in activities_data:
        act = Activity(**act_data)
        # Ensure all ratings key match config.group_members
        if set(act.ratings.keys()) != set(config.group_members):
             raise ValueError(f"Ratings for activity '{act.id}' do not match group members in config")
        activities.append(act)
        
    travel_times = data.get('travel_times', {})
    
    return config, activities, travel_times
