# Note: imports use relative module names (not `backend.xxx`) for deployment compatibility
import heapq
import sys
from typing import Dict

from models import Activity

def dijkstra(graph: dict[str, dict[str, int]], source: str) -> dict[str, int]:
    """
    Computes single-source shortest paths using Dijkstra's algorithm.
    Strictly follows CLRS Chapter 24.3 logic.
    
    Args:
        graph: Adjacency list representation of the graph, e.g., {u: {v: weight}}.
        source: The source node from which to calculate distances.
        
    Returns:
        A dictionary mapping each reachable node to its final shortest distance from the source.
    """
    # Gather all unique nodes present in the graph structure
    vertices = set(graph.keys())
    for adj in graph.values():
        vertices.update(adj.keys())
    vertices.add(source)
    
    # CLRS: INITIALIZE-SINGLE-SOURCE(G, s)
    # Set initial distance (v.d) for all vertices to infinity, except the source to 0
    d: dict[str, int] = {node: sys.maxsize for node in vertices}
    d[source] = 0
    
    # Priority Queue Q. Python's heapq behaves as a min-heap.
    # Elements will be tuples of (distance, node) to automatically sort by distance.
    Q: list[tuple[int, str]] = []
    
    # CLRS: Set S of vertices whose final shortest-path weights from the source 
    # have already been determined.
    S: set[str] = set()
    
    # Insert source initialization into queue Q
    heapq.heappush(Q, (0, source))
    
    while Q:
        # CLRS: EXTRACT-MIN(Q)
        curr_dist, u = heapq.heappop(Q)
        
        # In Python heapq, we can't efficiently decrease-key.
        # So we use lazy deletion: if a popped vertex is already finalized in S, skip.
        if u in S:
            continue
            
        # CLRS: S = S U {u}
        S.add(u)
        
        # CLRS: For each vertex v adjacent to u
        for v, weight in graph.get(u, {}).items():
            # Only process if not finalized
            if v in S:
               continue
               
            # CLRS: RELAX(u, v, w)
            # Check if traversing through u offers a tighter upper bound for shortest path to v
            if d[u] + weight < d[v]:
                d[v] = d[u] + weight
                # Instead of DECREASE-KEY, we push the updated shorter distance into the Q
                heapq.heappush(Q, (d[v], v))
                
    # Return dictionary only for paths that are connected (ignoring infinity/unreachable nodes)
    return {node: dist for node, dist in d.items() if dist != sys.maxsize}


def compute_all_pairs_shortest(travel_times: dict[str, dict[str, int]]) -> dict[str, dict[str, int]]:
    """
    Computes shortest travel times for all pairs.
    It runs Dijkstra from every available origin location in the graph matrix.
    
    Args:
        travel_times: Travel time matrix serving as our adjacency list graph.
        
    Returns:
        A matrix matching initial structure but containing shortest path distances.
    """
    shortest_times = {}
    for node in travel_times:
        shortest_times[node] = dijkstra(travel_times, node)
    return shortest_times


def is_transition_feasible(act_a: Activity, act_b: Activity, shortest_times: dict[str, dict[str, int]], slot_minutes: int) -> bool:
    """
    Evaluates whether a group travelling from Activity A can arrive on time for Activity B.
    
    Args:
        act_a: The prior activity structure.
        act_b: The next activity structure.
        shortest_times: The evaluated all shortest pairs mapping matrix.
        slot_minutes: Scale defined in config that converts slots to real time duration.
        
    Returns:
        True if group will reach on time, otherwise False.
    """
    # Ensure distance from node to itself implies instantaneous travel (0 mins)
    if act_a.location_id == act_b.location_id:
        travel_time = 0
    else:
        travel_time = shortest_times.get(act_a.location_id, {}).get(act_b.location_id, sys.maxsize)
        
    # act_a.end_slot * slot_minutes + travel_time(A.location, B.location) <= act_b.start_slot * slot_minutes
    arrival_time_minutes = (act_a.end_slot * slot_minutes) + travel_time
    start_time_minutes = act_b.start_slot * slot_minutes
    
    return arrival_time_minutes <= start_time_minutes
