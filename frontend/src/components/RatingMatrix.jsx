import { useState, useMemo, useCallback } from 'react';

/**
 * RatingMatrix – interactive member × activity scoring table.
 *
 * Fully controlled: all data flows in via props, mutations flow out
 * via onRatingsChange / onMembersChange.
 *
 * Every loaded activity is shown so every member can express a preference;
 * rows for activities the user has excluded are rendered dimmed as a hint
 * that those ratings won't influence the current optimization.
 *
 * Props
 * ─────
 *   activities           – Activity[] (full list — excluded ones included, dimmed)
 *   excludedIds          – Set<string> of excluded activity IDs (optional)
 *   groupMembers         – string[]
 *   ratings              – { member: { activityId: number } }
 *   scoreMode            – "average" | "min_max"
 *   onRatingsChange      – (newRatings: object) => void
 *   onMembersChange      – (newMembers: string[]) => void
 *   onBudgetChange       – (value: number) => void         (optional; used by presets)
 *   onScoreModeChange    – (mode: string) => void          (optional; used by presets)
 *   onExcludedIdsChange  – (set: Set<string>) => void      (optional; presets clear exclusions)
 */

/* ── Rating colour helpers ────────────────────────────────────── */
const ratingBg = (v) => {
  if (v >= 8) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (v <= 3) return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  return 'bg-white/[0.06] text-gray-200 border-white/[0.08]';
};

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/* ── Rating presets ───────────────────────────────────────────────
 * One-click demo scenarios that mirror run_experiments.py exactly, so
 * the Greedy vs DP numbers on screen match the write-up. Every preset
 * uses the same ratings (DEFAULT_RATINGS below, which are copied from
 * backend/data/vegas_activities.json); the scenarios differ only by
 *   • budget,
 *   • score mode, and
 *   • which activities are pre-included (everything else is excluded).
 *
 * Preset schema:
 *   members      : string[]                       (required)
 *   ratings      : { member: { actId: 1-10 } }    (required, ≥15 entries)
 *   budget       : number                          (required)
 *   scoreMode    : 'average' | 'min_max'           (required)
 *   includedIds  : string[] | null                 (null = include every activity)
 *
 * Expected Greedy-vs-DP gaps (from run_experiments.py):
 *   Default Las Vegas       DP +10.9%
 *   Tight Budget ($100)     DP  +7.6%
 *   Travel Matters          SAME (0%)
 *   All Free                SAME (0%)
 *   Min-Max Fairness        DP +15.6%
 */
const DEFAULT_RATINGS = {
  Alice: {
    casino_bellagio: 7, gondola_ride: 6, sphere: 10, pool_party: 5,
    high_roller: 8, buffet_caesars: 7, neon_museum: 9, escape_room: 7,
    shopping_forum: 9, mandalay_aquarium: 6, dinner_nobu: 9,
    fremont_street: 8, david_copperfield: 8, cirque_o: 10,
    helicopter_tour: 10,
  },
  Bob: {
    casino_bellagio: 8, gondola_ride: 5, sphere: 9, pool_party: 8,
    high_roller: 7, buffet_caesars: 9, neon_museum: 6, escape_room: 8,
    shopping_forum: 4, mandalay_aquarium: 5, dinner_nobu: 8,
    fremont_street: 7, david_copperfield: 9, cirque_o: 10,
    helicopter_tour: 10,
  },
  Charlie: {
    casino_bellagio: 9, gondola_ride: 7, sphere: 8, pool_party: 7,
    high_roller: 6, buffet_caesars: 8, neon_museum: 7, escape_room: 9,
    shopping_forum: 6, mandalay_aquarium: 8, dinner_nobu: 7,
    fremont_street: 8, david_copperfield: 7, cirque_o: 9,
    helicopter_tour: 10,
  },
};

const RATING_PRESETS = [
  {
    id: 'default',
    label: 'Default',
    description: 'All 15 activities · $500 · average — DP +10.9% over Greedy',
    members: ['Alice', 'Bob', 'Charlie'],
    ratings: DEFAULT_RATINGS,
    budget: 500,
    scoreMode: 'average',
    includedIds: null,
  },
  {
    id: 'tight_budget',
    label: 'Tight Budget',
    description: 'All 15 · $100 · average — pricey headliners drop out (DP +7.6%)',
    members: ['Alice', 'Bob', 'Charlie'],
    ratings: DEFAULT_RATINGS,
    budget: 100,
    scoreMode: 'average',
    includedIds: null,
  },
  {
    id: 'all_free',
    label: 'All Free',
    description: 'Only cost=$0 activities · $500 · average — Greedy = DP',
    members: ['Alice', 'Bob', 'Charlie'],
    ratings: DEFAULT_RATINGS,
    budget: 500,
    scoreMode: 'average',
    includedIds: ['casino_bellagio', 'fremont_street'],
  },
  {
    id: 'min_max',
    label: 'Min-Max',
    description: 'All 15 · $500 · min_max — fairness mode, DP +15.6% over Greedy',
    members: ['Alice', 'Bob', 'Charlie'],
    ratings: DEFAULT_RATINGS,
    budget: 500,
    scoreMode: 'min_max',
    includedIds: null,
  },
  {
    id: 'travel_matters',
    label: 'Travel Matters',
    description: 'Downtown + Strip South only · $500 · average — travel constraint dominates, Greedy = DP',
    members: ['Alice', 'Bob', 'Charlie'],
    ratings: DEFAULT_RATINGS,
    budget: 500,
    scoreMode: 'average',
    includedIds: ['fremont_street', 'neon_museum', 'helicopter_tour', 'mandalay_aquarium'],
  },
];

export default function RatingMatrix({
  activities,
  excludedIds,
  groupMembers,
  ratings,
  scoreMode,
  onRatingsChange,
  onMembersChange,
  onBudgetChange,
  onScoreModeChange,
  onExcludedIdsChange,
}) {
  // Fallback to an empty set so the component also works when no exclusion
  // state is wired up.
  const excluded = excludedIds ?? new Set();
  const [newName, setNewName] = useState('');
  // Track the cell currently showing the fill-popover (double-click)
  const [fillTarget, setFillTarget] = useState(null); // { type:'row'|'col', key:string }

  /* ── Computed value column ──────────────────────────────────── */
  const valueForActivity = useMemo(() => {
    const map = {};
    for (const act of activities) {
      const scores = groupMembers.map((m) => ratings?.[m]?.[act.id] ?? 5);
      if (scores.length === 0) { map[act.id] = 0; continue; }
      map[act.id] =
        scoreMode === 'min_max'
          ? Math.min(...scores)
          : +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    }
    return map;
  }, [activities, groupMembers, ratings, scoreMode]);

  /* ── Single-cell change ─────────────────────────────────────── */
  const handleChange = useCallback(
    (member, actId, value) => {
      const clamped = Math.max(1, Math.min(10, Number(value) || 1));
      onRatingsChange({
        ...ratings,
        [member]: { ...(ratings[member] || {}), [actId]: clamped },
      });
    },
    [ratings, onRatingsChange],
  );

  /* ── Bulk fill helpers ──────────────────────────────────────── */
  const fillRow = useCallback(
    (actId, value) => {
      const next = { ...ratings };
      for (const m of groupMembers) {
        next[m] = { ...(next[m] || {}), [actId]: value };
      }
      onRatingsChange(next);
      setFillTarget(null);
    },
    [ratings, groupMembers, onRatingsChange],
  );

  const fillCol = useCallback(
    (member, value) => {
      const next = {
        ...ratings,
        [member]: { ...(ratings[member] || {}) },
      };
      for (const act of activities) {
        next[member][act.id] = value;
      }
      onRatingsChange(next);
      setFillTarget(null);
    },
    [ratings, activities, onRatingsChange],
  );

  /* ── Member add / remove ────────────────────────────────────── */
  const handleAddMember = () => {
    const name = newName.trim();
    if (!name || groupMembers.includes(name) || groupMembers.length >= 6) return;
    onMembersChange([...groupMembers, name]);
    // Seed the new member's ratings to 5
    const memberRatings = {};
    for (const a of activities) memberRatings[a.id] = 5;
    onRatingsChange({ ...ratings, [name]: memberRatings });
    setNewName('');
  };

  const handleRemoveMember = (name) => {
    onMembersChange(groupMembers.filter((m) => m !== name));
    const next = { ...ratings };
    delete next[name];
    onRatingsChange(next);
  };

  /* ── Preset application ─────────────────────────────────────── */
  // Replace members + the full ratings matrix, and optionally override
  // budget / score mode / activity inclusion list. Per-member rating
  // dicts are shallow-copied so we never leak the preset object's
  // references into component state.
  //
  // `preset.includedIds`:
  //   • null / undefined → clear all exclusions (every activity in)
  //   • string[]         → include exactly those; exclude the rest
  //                        (computed against the current activity list
  //                        so unknown ids from the preset are ignored).
  const applyPreset = useCallback(
    (preset) => {
      onMembersChange([...preset.members]);
      const nextRatings = {};
      for (const m of preset.members) {
        nextRatings[m] = { ...(preset.ratings[m] || {}) };
      }
      onRatingsChange(nextRatings);
      if (preset.budget !== undefined && onBudgetChange) {
        onBudgetChange(preset.budget);
      }
      if (preset.scoreMode !== undefined && onScoreModeChange) {
        onScoreModeChange(preset.scoreMode);
      }
      if (onExcludedIdsChange) {
        if (preset.includedIds == null) {
          onExcludedIdsChange(new Set());
        } else {
          const allow = new Set(preset.includedIds);
          const nextExcluded = new Set(
            activities.filter((a) => !allow.has(a.id)).map((a) => a.id),
          );
          onExcludedIdsChange(nextExcluded);
        }
      }
    },
    [activities, onMembersChange, onRatingsChange, onBudgetChange, onScoreModeChange, onExcludedIdsChange],
  );

  /* ── Empty state ────────────────────────────────────────────── */
  if (!activities.length || !groupMembers.length) {
    return (
      <div className="glass-card-sm p-6 text-center text-gray-500 text-sm">
        {!groupMembers.length
          ? 'Add at least one group member to start rating.'
          : 'Loading activities…'}
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="glass-card p-5 space-y-3">
      <p className="section-label">Rating Matrix</p>
      <p className="text-[11px] text-gray-500 -mt-1">
        Double-click a <strong>member name</strong> or <strong>activity row</strong> to bulk-fill scores.
      </p>

      {/* ── Preset fillers: replace members + ratings in one click ── */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] text-gray-500 mr-1">Presets:</span>
        {RATING_PRESETS.map((p) => (
          <button
            key={p.id}
            id={`rating-preset-${p.id}`}
            onClick={() => applyPreset(p)}
            title={p.description}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold
                       bg-indigo-500/15 text-indigo-300 border border-indigo-500/25
                       hover:bg-indigo-500/25 hover:border-indigo-500/40 transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[13px] border-collapse min-w-[480px]">
          {/* ── Head ───────────────────────────────────────────── */}
          <thead>
            <tr>
              <th className="text-left text-gray-500 font-semibold pb-2 pr-3 sticky left-0 bg-[#1e2536]/80 backdrop-blur z-10 whitespace-nowrap">
                Activity
              </th>
              {groupMembers.map((m) => (
                <th key={m} className="text-center font-semibold pb-2 px-1 whitespace-nowrap relative">
                  {/* Name + remove button */}
                  <span
                    className="text-gray-400 cursor-pointer select-none hover:text-indigo-300 transition"
                    onDoubleClick={() =>
                      setFillTarget((prev) =>
                        prev?.type === 'col' && prev.key === m ? null : { type: 'col', key: m },
                      )
                    }
                    title="Double-click to fill entire column"
                  >
                    {m}
                  </span>
                  <button
                    onClick={() => handleRemoveMember(m)}
                    className="ml-1 text-[10px] text-gray-600 hover:text-rose-400 transition"
                    aria-label={`Remove ${m}`}
                  >
                    ×
                  </button>

                  {/* Column fill popover */}
                  {fillTarget?.type === 'col' && fillTarget.key === m && (
                    <FillPopover onSelect={(v) => fillCol(m, v)} onClose={() => setFillTarget(null)} />
                  )}
                </th>
              ))}
              <th className="text-center text-gray-500 font-semibold pb-2 px-2 whitespace-nowrap">
                Value
              </th>
            </tr>
          </thead>

          {/* ── Body ───────────────────────────────────────────── */}
          <tbody>
            {activities.map((act) => {
              const isExcluded = excluded.has(act.id);
              return (
              <tr
                key={act.id}
                className={`group border-t border-white/[0.04] hover:bg-white/[0.02] transition
                  ${isExcluded ? 'opacity-50' : ''}`}
              >
                {/* Activity label */}
                <td
                  className="py-1.5 pr-3 sticky left-0 bg-[#1e2536]/80 backdrop-blur z-10 cursor-pointer select-none relative"
                  onDoubleClick={() =>
                    setFillTarget((prev) =>
                      prev?.type === 'row' && prev.key === act.id ? null : { type: 'row', key: act.id },
                    )
                  }
                  title="Double-click to fill entire row"
                >
                  <span className={`text-gray-300 font-medium truncate block max-w-[160px]
                    ${isExcluded ? 'line-through decoration-gray-600' : ''}`}>
                    {act.name}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {act.time_range}{isExcluded ? ' · excluded' : ''}
                  </span>

                  {/* Row fill popover */}
                  {fillTarget?.type === 'row' && fillTarget.key === act.id && (
                    <FillPopover onSelect={(v) => fillRow(act.id, v)} onClose={() => setFillTarget(null)} />
                  )}
                </td>

                {/* Rating cells */}
                {groupMembers.map((m) => {
                  const val = ratings?.[m]?.[act.id] ?? 5;
                  return (
                    <td key={m} className="py-1.5 px-1 text-center">
                      <select
                        id={`rating-${m}-${act.id}`}
                        value={val}
                        onChange={(e) => handleChange(m, act.id, e.target.value)}
                        className={`w-12 rounded-lg border text-center text-sm py-1 cursor-pointer
                          appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition
                          ${ratingBg(val)}`}
                      >
                        {SCORES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}

                {/* Computed value */}
                <td className="py-1.5 px-2 text-center">
                  <span
                    className={`inline-block min-w-[2.2rem] rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums
                      ${valueForActivity[act.id] >= 8
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : valueForActivity[act.id] <= 3
                          ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-white/[0.06] text-gray-300'}`}
                  >
                    {valueForActivity[act.id]}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add member row ───────────────────────────────────── */}
      {groupMembers.length < 6 && (
        <div className="flex gap-2 pt-1">
          <input
            id="matrix-add-member-input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            placeholder="New member name…"
            maxLength={16}
            className="flex-1 rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 text-sm text-white
                       placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition"
          />
          <button
            id="matrix-add-member-btn"
            onClick={handleAddMember}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300
                       hover:bg-indigo-500/30 border border-indigo-500/20 hover:border-indigo-500/30 transition"
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   FillPopover – tiny inline popover to pick a bulk-fill value (1-10)
   ================================================================ */
function FillPopover({ onSelect, onClose }) {
  return (
    <>
      {/* Invisible backdrop to catch outside clicks */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 glass-card-sm px-2 py-1.5 flex gap-1 shadow-xl animate-in fade-in">
        {SCORES.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className={`w-6 h-6 rounded-md text-[11px] font-bold transition
              ${s >= 8
                ? 'bg-emerald-500/25 text-emerald-300 hover:bg-emerald-500/40'
                : s <= 3
                  ? 'bg-rose-500/25 text-rose-300 hover:bg-rose-500/40'
                  : 'bg-white/[0.08] text-gray-300 hover:bg-white/[0.15]'}`}
          >
            {s}
          </button>
        ))}
      </div>
    </>
  );
}
