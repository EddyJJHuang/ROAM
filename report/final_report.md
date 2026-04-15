# ROAM: Group Itinerary Optimization System
**Author:** Jiajun Huang  
**Course:** CS 5800 Algorithms

## 1. Introduction
- Background: Describe the cognitive and logistical difficulty of organizing group trips containing diverse preferences, budget limits, and complex transit demands.
- Motivation: Explain why an algorithmic solution is far more effective compared to tedious manual scheduling and subjective group voting.
- Objective: Design and implement ROAM, a system to deterministically compute optimal itineraries.
- [TODO: Extract core background concepts and expected goals from the project Proposal]

## 2. Problem Formulation
- Input Set: Activity list, Config profile (Group member subset, slot boundaries, budget boundaries), Travel Time mapping graph.
- Constraints Formulation:
  - Time overlaps: Intervals must be strictly disjoint (`end_A <= start_B`).
  - Dijkstra Transition: Realistic spatial transitions limit physical arrival (`end_A + travel_time <= start_B`).
  - Capacity (0-1 Knapsack): Sum of total cost `cost * group_size` cannot exceed total budget.
- Output Expected: A valid schedule array optimizing an objective outcome.
- Objective Function: Maximization of aggregate user values per `average` or `min_max` scoring.
- [TODO: Use mathematical formulas to accurately define the input variables, constraints, and objective functions mentioned above]

## 3. Algorithm Design

### 3.1 Dijkstra for Travel Times
- Application: Calculating all pairs' shortest paths among locations securely bounding travel constraints.
- Relationship to **CLRS Chapter 24.3**: 
  - Using Min-priority queue (via `heapq`) for `EXTRACT-MIN(Q)`.
  - Simulating shortest path initialization via `INITIALIZE-SINGLE-SOURCE`.
  - Enacting edge weight bounds checking akin to the standard `RELAX(u,v)` function.
- [TODO: Detail how physical venues are mapped as graph nodes and how the transit network is represented as an adjacency matrix in ROAM]

### 3.2 Greedy Baseline
- Strategy: Utilizing a fractional knapsack heuristic, executing sorts by descending `value/cost` ratio.
- Contrast with **CLRS Chapter 16.1 (Activity-Selection Problem)**:
  - CLRS implies classic interval scheduling is solved optimally by choosing earliest finish times.
  - ROAM's problem involves node weights (value) and secondary capacities (budget), making it a 0-1 Knapsack fusion where Greedy guarantees decay.
- Counter-example Suboptimality Proof: Demonstrating why the highest-ratio selection can block overlapping, superior combinations due to fixed fractional integer limitations.
- [TODO: Insert the mathematical proof of suboptimality or reference the `trap` scenario from the test cases]

### 3.3 Dynamic Programming Solution
- Connections to **CLRS Chapter 15.3**:
  - Defining Overlapping Subproblems: Proving that scheduling iterations revisit the exact subsets of available capacity and remaining times.
  - Validating Optimal Substructure: Displaying how a globally optimal timeline is composed of locally optimal decisions mapped across smaller budgets/slots.
- State Transition Definition: Breaking down whether to "Include" or "Exclude" activities recursively.
- [TODO: Write out the complete DP state transition equation (Bellman Equation) and explain the memoization logic]

### 3.4 Complexity Analysis
- Greedy Execution Time & Space Complexity limits.
- Dijkstra Matrix Search Time & Space Complexity limits.
- DP Array Dimensions Time & Space Complexity bounds.
- [TODO: Attach Big-O notation tables for each algorithm set constraint]

## 4. Implementation
- Framework Choice: Outline Python conventions (Dataclasses, Pytest sets).
- System Architecture: Break down Module segregation (`models`, `dijkstra`, `greedy_solver`, `dp_solver`).
- Validation & Security: Details regarding sanity checking configs (Ratings bounds, Budget validity).
- [TODO: Insert system architecture and class relationship visualization diagrams]

## 5. Experimental Results
- Standard Set Benchmarking: Run the default Las Vegas testing JSON.
- Comparative Edge Case Profiling:
  - Validating `scenario_greedy_fails`: Tracking exact ratio failure points.
  - Validating `scenario_tight_budget`: Checking multiplier constraints on member counts.
  - Validating `scenario_travel_matters`: Proving topological boundaries from Dijkstra evaluation.
  - Validating `scenario_all_free`: Showcasing greedy/DP overlap during weightless optimizations.
  - Validating `scenario_min_max`: Polled score deviation differences.
- Greedy Counter Analysis Segment: Explain the observed "Value Lost" margin.
- Practical Execution Time: Scaling boundaries (Execution time in `ms` for large parameters).
- [TODO: Fill in the actual DP execution output for each scenario and compare them using tables]
- [TODO: Insert runtime performance graphs plotting ms latency against scaling activities or budget sizes]

## 6. Discussion
- Empirical Limitations: Acknowledge that the resulting Multi-Dimensional DP suffers from extensive RAM utilization under fine integer granularities or huge budgets. 
- Expansion Options:
  - Implementing asynchronous variable elasticity (Non-fixed 30 mins slots).
  - Expanding mapping to cover multi-day disjoint multi-member schedules.
- [TODO: Discuss the possibility of integrating advanced heuristic searches (like A* or Beam Search) as DP substitutions]

## 7. Conclusion
- Synthesis of Findings: Recap exactly how algorithm designs mitigated complex logic boundaries and why DP stands optimal above naive greedy subsets.
- [TODO: Provide final concluding thoughts and retrospective analysis]

## 8. References
- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
  - CLRS Chapter 15.3: Elements of dynamic programming.
  - CLRS Chapter 16.1: An activity-selection problem.
  - CLRS Chapter 24.3: Dijkstra's algorithm.
- [TODO: Attach links to any utilized Python core libraries or third-party open-source components]
