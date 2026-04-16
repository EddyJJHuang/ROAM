import { useState, useEffect, useCallback } from 'react';

import ActivityInput from './components/ActivityInput';
import RatingMatrix   from './components/RatingMatrix';
import BudgetControls from './components/BudgetControls';
import Timeline       from './components/Timeline';
import ComparisonChart from './components/ComparisonChart';
import { fetchActivities, solveItinerary } from './api';

/* ────────────────────────────────────────────────────────────── */

export default function App() {
  // ── Data loaded from the backend ────────────────────────────
  const [allActivities, setAllActivities] = useState([]);
  const [travelTimes, setTravelTimes]     = useState({});
  const [defaultConfig, setDefaultConfig] = useState(null);

  // ── User-controlled state ───────────────────────────────────
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [groupMembers, setGroupMembers]   = useState(['Alice', 'Bob']);
  const [ratings, setRatings]             = useState({});  // { member: { actId: score } }
  const [budget, setBudget]               = useState(500);
  const [scoreMode, setScoreMode]         = useState('average');

  // ── Results ─────────────────────────────────────────────────
  const [results, setResults]   = useState(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState(null);

  // ── Load preset activities on mount ─────────────────────────
  useEffect(() => {
    fetchActivities()
      .then((data) => {
        setAllActivities(data.activities);
        setTravelTimes(data.travel_times);
        setDefaultConfig(data.config);
        // Start with nothing selected — user chooses what to consider
        setSelectedIds(new Set());
        // Seed default ratings (5 for everything)
        const seed = {};
        for (const m of ['Alice', 'Bob']) {
          seed[m] = {};
          for (const a of data.activities) seed[m][a.id] = 5;
        }
        setRatings(seed);
      })
      .catch((err) => setError(`Failed to load activities: ${err.message}`));
  }, []);

  // ── Helpers ─────────────────────────────────────────────────
  const selectedActivities = allActivities.filter((a) => selectedIds.has(a.id));

  // Total group spend for currently-selected activities
  // (backend charges act.cost × group_size against the group budget)
  const groupSize = Math.max(groupMembers.length, 1);
  const selectedGroupCost = selectedActivities.reduce(
    (sum, a) => sum + a.cost * groupSize,
    0,
  );
  const budgetExhausted = selectedGroupCost >= budget;

  const toggleActivity = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      // Block new paid selections once the group budget is reached,
      // but always allow free activities (cost === 0) through.
      const act = allActivities.find((a) => a.id === id);
      const isFree = act ? act.cost === 0 : false;
      if (budgetExhausted && !isFree) return prev;
      next.add(id);
      return next;
    });
  }, [budgetExhausted, allActivities]);

  const handleRatingChange = useCallback((member, actId, value) => {
    const clamped = Math.max(1, Math.min(10, value || 1));
    setRatings((prev) => ({
      ...prev,
      [member]: { ...(prev[member] || {}), [actId]: clamped },
    }));
  }, []);

  const addMember = useCallback((name) => {
    setGroupMembers((prev) => [...prev, name]);
    // Initialize ratings for the new member with 5 for every activity
    setRatings((prev) => {
      const memberRatings = {};
      for (const a of allActivities) memberRatings[a.id] = 5;
      return { ...prev, [name]: memberRatings };
    });
  }, [allActivities]);

  const removeMember = useCallback((name) => {
    setGroupMembers((prev) => prev.filter((m) => m !== name));
    setRatings((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  // ── Solve ───────────────────────────────────────────────────
  const handleOptimize = async () => {
    if (groupMembers.length === 0) {
      setError('Add at least one group member.');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Select at least one activity.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await solveItinerary({
        config: {
          group_members: groupMembers,
          score_mode: scoreMode,
          budget,
        },
        ratings,
      });
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Ambient gradient blobs ─────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute top-1/3 right-0 h-[500px] w-[500px] rounded-full bg-violet-600/8 blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-amber-500/5 blur-[100px]" />
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="px-6 py-8 md:px-12 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight gradient-text">
          ROAM
        </h1>
        <p className="mt-2 text-sm md:text-base text-gray-400 max-w-xl mx-auto">
          Ratings-Optimized Activity Manager — maximize group satisfaction
          under time &amp; budget constraints with dynamic programming.
        </p>
      </header>

      {/* ── Main grid ──────────────────────────────────────── */}
      <main className="flex-1 px-4 md:px-10 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column — inputs */}
        <section className="lg:col-span-5 space-y-6">
          <BudgetControls
            budget={budget}
            onBudgetChange={setBudget}
            scoreMode={scoreMode}
            onScoreModeChange={setScoreMode}
            groupMembers={groupMembers}
            onAddMember={addMember}
            onRemoveMember={removeMember}
          />

          <ActivityInput
            activities={allActivities}
            selected={selectedIds}
            onToggle={toggleActivity}
            groupSize={groupSize}
            budget={budget}
            selectedGroupCost={selectedGroupCost}
            budgetExhausted={budgetExhausted}
          />

          <RatingMatrix
            activities={selectedActivities}
            groupMembers={groupMembers}
            ratings={ratings}
            scoreMode={scoreMode}
            onRatingsChange={setRatings}
            onMembersChange={setGroupMembers}
          />

          {/* Optimize button */}
          <button
            id="optimize-btn"
            onClick={handleOptimize}
            disabled={isLoading}
            className="btn-glow w-full text-base"
          >
            {isLoading ? (
              <>
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Optimizing…
              </>
            ) : (
              '🚀 Optimize Itinerary'
            )}
          </button>

          {/* Error toast */}
          {error && (
            <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </section>

        {/* Right column — results */}
        <section className="lg:col-span-7 space-y-6">
          <ComparisonChart
            comparison={results?.comparison}
            greedyResult={results?.greedy}
            optimalResult={results?.optimal}
            budget={budget}
          />

          <Timeline
            greedyResult={results?.greedy}
            optimalResult={results?.optimal}
            config={defaultConfig}
            travelTimes={travelTimes}
          />
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="text-center py-6 text-xs text-gray-600">
        CS 5800 Algorithms — Jiajun Huang &amp; Nicholas Kaplun · Northeastern University
      </footer>
    </div>
  );
}
