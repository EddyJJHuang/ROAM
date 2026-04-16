/**
 * ActivityInput – displays the preset activity list loaded from the API.
 * Users can toggle individual activities on/off for the optimization run.
 *
 * Props:
 *   activities        – array of activity objects from the API
 *   selected          – Set<string> of currently-selected activity IDs
 *   onToggle          – (activityId: string) => void
 *   groupSize         – number of group members (≥ 1)
 *   budget            – total group budget ($)
 *   selectedGroupCost – current total group cost of selections ($)
 *   budgetExhausted   – true when selectedGroupCost ≥ budget
 */
export default function ActivityInput({
  activities,
  selected,
  onToggle,
  groupSize = 1,
  budget = 0,
  selectedGroupCost = 0,
  budgetExhausted = false,
}) {
  if (!activities || activities.length === 0) {
    return (
      <div className="glass-card-sm p-6 text-center text-gray-400">
        <p className="text-sm">Loading activities…</p>
      </div>
    );
  }

  const remaining = Math.max(budget - selectedGroupCost, 0);

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="section-label">Activities</p>
        <p className="text-xs text-gray-400 tabular-nums">
          <span className={budgetExhausted ? 'text-rose-300 font-semibold' : 'text-gray-200 font-medium'}>
            ${selectedGroupCost}
          </span>
          <span className="text-gray-500"> / ${budget}</span>
          <span className="text-gray-500"> · ${remaining} left</span>
        </p>
      </div>

      {budgetExhausted && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-300">
          Group budget reached. Deselect a paid activity to add another — free activities can still be selected.
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {activities.map((act) => {
          const isOn = selected.has(act.id);
          const groupCost = act.cost * groupSize;
          // Free activities bypass the budget gate: they add $0 to the group
          // total, so users can always keep selecting them even after the
          // group budget is reached.
          const isFree = act.cost === 0;
          const disabled = !isOn && budgetExhausted && !isFree;
          return (
            <button
              key={act.id}
              id={`activity-toggle-${act.id}`}
              onClick={() => onToggle(act.id)}
              disabled={disabled}
              aria-disabled={disabled}
              title={
                disabled
                  ? 'Budget reached — deselect a paid activity first (free activities are still available)'
                  : undefined
              }
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all duration-200
                ${isOn
                  ? 'bg-indigo-500/15 border border-indigo-500/30 text-white'
                  : disabled
                    ? 'bg-white/[0.02] border border-white/[0.04] text-gray-600 cursor-not-allowed opacity-60'
                    : 'bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:bg-white/[0.06]'}`}
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{act.name}</span>
                <span className="text-xs text-gray-500">{act.time_range} &middot; {act.location_id}</span>
              </div>
              <div className="shrink-0 flex flex-col items-end">
                <span className="text-xs font-semibold tabular-nums">
                  {act.cost === 0 ? 'FREE' : `$${act.cost}`}
                </span>
                {act.cost > 0 && groupSize > 1 && (
                  <span className="text-[10px] text-gray-500 tabular-nums">
                    ${groupCost} group
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
