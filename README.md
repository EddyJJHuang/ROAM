# ROAM: Ratings-Optimized Activity Manager

Maximizing Group Satisfaction Under Time and Budget Constraints

**CS 5800 — Algorithms Final Project**
Northeastern University, Silicon Valley Campus

**Authors:** Jiajun Huang & Nicholas Kaplun

---

## Abstract

ROAM solves the group trip planning problem: given a set of candidate activities in Las Vegas — each with a fixed time window, a cost, a location, and individual preference ratings from each group member — compute a one-day itinerary that maximizes total group satisfaction while respecting all time and budget constraints. We implement and compare two approaches: a greedy baseline (value-to-cost ratio) and a 2D dynamic programming solution that finds the provably optimal schedule. Travel times between venues are computed using Dijkstra's shortest-path algorithm and incorporated as feasibility constraints on activity transitions.

## Problem Formulation

- **Input:** A set of *n* activities, each with start time, end time, cost, location, and per-member ratings (1–10). A shared daily budget. Pairwise travel times between all venue locations.
- **Objective:** Select a subset of non-overlapping activities (accounting for inter-venue travel time) that maximizes the sum of group satisfaction scores while staying within budget.
- **Score function:** Each activity's value is the average of all group members' ratings. An alternative min-max mode (maximize the minimum individual score) is also supported.

## Algorithms

### Dijkstra's Shortest Paths (CLRS Ch. 24.3)

Venues are modeled as nodes in a weighted graph. Dijkstra's algorithm computes shortest travel times between all venue pairs, which determine whether transitioning from activity A to activity B is time-feasible.

### Greedy Baseline (CLRS Ch. 16.1)

Extends the classic activity-selection problem to the weighted case. Activities are sorted by value-to-cost ratio, and the greedy algorithm iteratively selects the highest-ratio activity that does not conflict with already-selected activities (time overlap or budget overflow). This serves as a performance benchmark.

### Dynamic Programming — Optimal Solution (CLRS Ch. 15.3)

A 2D DP table `dp[t][b]` stores the maximum satisfaction achievable from time slot *t* onward with remaining budget *b*. Activities are sorted by start time. The recurrence considers, for each state, whether to include each feasible activity or skip it. This approach guarantees the globally optimal solution.

**State space:** 32 time slots × 50 budget units = 1,600 states.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Algorithm engine | Python 3.11+ |
| Backend API | Flask |
| Frontend | React |
| Visualization | Recharts (timeline + comparison charts) |
| Data | JSON (15 curated Las Vegas activities) |

## Project Structure

```
roam/
├── backend/
│   ├── app.py                  # Flask API server
│   ├── models.py               # Data models and loaders
│   ├── dijkstra.py             # Shortest-path travel time computation
│   ├── greedy_solver.py        # Greedy baseline algorithm
│   ├── dp_solver.py            # 2D dynamic programming solver
│   └── data/
│       └── vegas_activities.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── ActivityInput.jsx
│   │       ├── RatingMatrix.jsx
│   │       ├── Timeline.jsx
│   │       └── ComparisonChart.jsx
│   └── package.json
├── tests/
│   ├── test_dijkstra.py
│   ├── test_greedy.py
│   └── test_dp.py
├── report/                     # Final report and presentation
├── LICENSE
├── .gitignore
└── README.md
```

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
# API running at http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm start
# UI running at http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/activities` | Retrieve preset Las Vegas activities |
| `POST` | `/api/solve` | Run both solvers, return optimal and greedy results |
| `POST` | `/api/custom` | Submit user-defined activities and solve |

## Results

*To be completed after experimentation.*

- Greedy vs DP satisfaction comparison across test scenarios
- Cases where greedy fails to find the optimal solution
- Runtime performance comparison
- Sensitivity analysis on budget and group size

## References

- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
  - Section 15.3: Elements of Dynamic Programming (pp. 378–389)
  - Section 16.1: An Activity-Selection Problem (pp. 415–419)
  - Section 24.3: Dijkstra's Algorithm (pp. 658–663)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
