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
 *   activities      – Activity[] (full list — excluded ones included, dimmed)
 *   excludedIds     – Set<string> of excluded activity IDs (optional)
 *   groupMembers    – string[]
 *   ratings         – { member: { activityId: number } }
 *   scoreMode       – "average" | "min_max"
 *   onRatingsChange – (newRatings: object) => void
 *   onMembersChange – (newMembers: string[]) => void
 */

/* ── Rating colour helpers ────────────────────────────────────── */
const ratingBg = (v) => {
  if (v >= 8) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (v <= 3) return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  return 'bg-white/[0.06] text-gray-200 border-white/[0.08]';
};

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function RatingMatrix({
  activities,
  excludedIds,
  groupMembers,
  ratings,
  scoreMode,
  onRatingsChange,
  onMembersChange,
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
