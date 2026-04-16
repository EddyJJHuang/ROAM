/**
 * API client for the ROAM backend.
 *
 * The base URL is injected at build time from VITE_API_BASE_URL:
 *   - dev   → .env.development (http://localhost:5001, matches Flask)
 *   - prod  → .env.production  (https://api.roam.eddyislearning.ai)
 * The fallback is only hit when no .env file is loaded.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Thin fetch wrapper that parses JSON and surfaces backend error messages
 * (the Flask API returns `{ error: "..." }` on non-2xx responses).
 */
async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server returned ${res.status}`);
  }
  return res.json();
}

/** GET /api/activities — preset Vegas activities, travel times, default config. */
export async function fetchActivities() {
  return request('/api/activities');
}

/** POST /api/solve — runs both greedy and DP solvers, returns comparison. */
export async function solveItinerary(data) {
  return request('/api/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
