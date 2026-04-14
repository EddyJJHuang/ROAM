import unittest
from backend.models import Activity, Config
from backend.dp_solver import dp_solve
from backend.greedy_solver import greedy_solve

class TestDPSolver(unittest.TestCase):
    def setUp(self):
        self.config = Config(
            group_members=["Alice", "Bob"],
            score_mode="average",
            slot_minutes=30,
            total_slots=10,
            budget=100,
            budget_granularity=10
        )
        self.shortest_times = {
            "A": {"A": 0, "B": 15, "C": 30},
            "B": {"A": 15, "B": 0, "C": 15},
            "C": {"A": 30, "B": 15, "C": 0}
        }
        
    def test_small_scale_optimal(self):
        # A test where greedy fails to find the optimal result but DP succeeds.
        # Budget = 100. group_size = 2.
        # Act 1: cost 10 (total 20), value 10 -> ratio 1.0
        # Act 2: cost 10 (total 20), value 8  -> ratio 0.8
        # Act 3: cost 10 (total 20), value 8  -> ratio 0.8
        # Overlaps: Time interval A2: 0-3, A1: 2-5, A3: 4-7
        # Greedy (by ratio) picks A1. Then A2 (0-3) overlaps with A1 (2-5). A3 (4-7) overlaps with A1 (2-5).
        # Greedy final value = 10.
        # DP considers combinations -> A2 + A3 (0-3 and 4-7).
        # Travel constraint: A2 ends at 3. Location B -> C is 15m. ceil(15/30) = 1 slot required.
        # A3 starts at 4. 3 + 1 = 4 <= 4. Time travel is perfectly feasible.
        # DP final value = 8 + 8 = 16.
        activities = [
            Activity("1", "A1", 10, 2, 5, "A", {"Alice": 10, "Bob": 10}),
            Activity("2", "A2", 10, 0, 3, "B", {"Alice": 8, "Bob": 8}),
            Activity("3", "A3", 10, 4, 7, "C", {"Alice": 8, "Bob": 8})
        ]
        
        dp_result = dp_solve(activities, self.config, self.shortest_times)
        greedy_result = greedy_solve(activities, self.config, self.shortest_times)
        
        self.assertEqual(dp_result["total_value"], 16.0)
        self.assertEqual(len(dp_result["selected"]), 2)
        # Verify DP outperforms Greedy in this specific layout structure
        self.assertTrue(dp_result["total_value"] > greedy_result["total_value"])

    def test_dp_ge_greedy(self):
        # On any valid generic case, DP total_value >= Greedy total_value
        activities = [
            Activity("1", "A1", 10, 0, 2, "A", {"Alice": 9, "Bob": 7}),
            Activity("2", "A2", 10, 1, 3, "A", {"Alice": 8, "Bob": 8}),
            Activity("3", "A3", 20, 3, 5, "B", {"Alice": 5, "Bob": 6}),
            Activity("4", "A4", 5, 6, 8, "C", {"Alice": 10, "Bob": 10}),
        ]
        dp_result = dp_solve(activities, self.config, self.shortest_times)
        greedy_result = greedy_solve(activities, self.config, self.shortest_times)
        
        self.assertGreaterEqual(dp_result["total_value"], greedy_result["total_value"])

    def test_exact_budget(self):
        # Budget exactly consumed boundary case
        conf = Config(["Alice", "Bob"], "average", total_slots=10, budget=40, budget_granularity=10)
        activities = [
            Activity("1", "A1", 10, 0, 2, "A", {"Alice": 5, "Bob": 5}), # total cost 20
            Activity("2", "A2", 10, 3, 5, "B", {"Alice": 5, "Bob": 5})  # total cost 20
        ]
        # Travel constraint: A->B is 15 mins. slots=30m. required gap = ceil(15/30) = 1.
        # A1 ends at 2. required gap = 1. A2 starts at 3. 2+1=3 <= 3 (feasible transition).
        dp_res = dp_solve(activities, conf, self.shortest_times)
        self.assertEqual(dp_res["total_cost"], 40)
        self.assertEqual(dp_res["budget_remaining"], 0)
        self.assertEqual(len(dp_res["selected"]), 2)

    def test_impossible_budget(self):
        # Case where all activities are too expensive
        conf = Config(["Alice", "Bob"], "average", total_slots=10, budget=10, budget_granularity=10)
        activities = [
            Activity("1", "A1", 10, 0, 2, "A", {"Alice": 5, "Bob": 5}), # total cost 20 > 10 tight budget
        ]
        dp_res = dp_solve(activities, conf, self.shortest_times)
        self.assertEqual(len(dp_res["selected"]), 0)
        self.assertEqual(dp_res["total_value"], 0.0)

    def test_single_activity(self):
        # Only 1 activity valid
        activities = [
            Activity("1", "A1", 10, 0, 2, "A", {"Alice": 5, "Bob": 5})
        ]
        dp_res = dp_solve(activities, self.config, self.shortest_times)
        self.assertEqual(len(dp_res["selected"]), 1)
        self.assertEqual(dp_res["selected"][0].id, "1")

if __name__ == '__main__':
    unittest.main()
