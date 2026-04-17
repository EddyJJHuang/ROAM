/**
 * BudgetControls – group-budget slider, member list, and score-mode toggle.
 *
 * The budget is the *total* pool for the whole group. A per-person hint is
 * rendered below the slider so users can see what the budget means per head.
 *
 * Props:
 *   budget            – total group budget ($)
 *   onBudgetChange    – (value: number) => void
 *   scoreMode         – "average" | "min_max"
 *   onScoreModeChange – (mode: string) => void
 *   groupMembers      – string[]
 *   onAddMember       – (name: string) => void
 *   onRemoveMember    – (name: string) => void
 */
import { useState } from 'react';

export default function BudgetControls({
  budget, onBudgetChange,
  scoreMode, onScoreModeChange,
  groupMembers, onAddMember, onRemoveMember,
}) {
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    const name = newName.trim();
    if (name && !groupMembers.includes(name) && groupMembers.length < 6) {
      onAddMember(name);
      setNewName('');
    }
  };

  return (
    <div className="glass-card p-6 space-y-6">
      {/* ── Group Members ──────────────────────────────────── */}
      <div className="space-y-3">
        <p className="section-label">Group Members</p>
        <div className="flex flex-wrap gap-2">
          {groupMembers.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
            >
              {m}
              <button
                id={`remove-member-${m}`}
                onClick={() => onRemoveMember(m)}
                className="hover:text-red-400 transition ml-0.5"
                aria-label={`Remove ${m}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {groupMembers.length < 6 && (
          <div className="flex gap-2">
            <input
              id="new-member-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add member…"
              className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 text-sm text-white placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
            />
            <button
              id="add-member-btn"
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {/* ── Budget ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="section-label">Group Budget <span className="text-gray-500 font-normal normal-case tracking-normal">(total for the whole team)</span></p>
        </div>
        <div className="flex items-center gap-4">
          <input
            id="budget-slider"
            type="range"
            min={0}
            max={2000}
            step={50}
            value={budget}
            onChange={(e) => onBudgetChange(Number(e.target.value))}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-lg font-bold tabular-nums text-white">${budget}</span>
        </div>
        {/* Per-person breakdown — makes the total-budget semantics explicit */}
        {groupMembers.length > 0 && (
          <p className="text-xs text-gray-500">
            ≈ <span className="tabular-nums text-gray-300 font-medium">
              ${(budget / groupMembers.length).toFixed(2)}
            </span>{' '}
            per person · {groupMembers.length} member{groupMembers.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {/* ── Score Mode ─────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="section-label">Score Mode</p>
        <div className="flex gap-2">
          {[
            { value: 'average', label: 'Average' },
            { value: 'min_max', label: 'Min-Max (Fair)' },
          ].map((opt) => (
            <button
              key={opt.value}
              id={`score-mode-${opt.value}`}
              onClick={() => onScoreModeChange(opt.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                ${scoreMode === opt.value
                  ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/30'
                  : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:bg-white/[0.06]'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
