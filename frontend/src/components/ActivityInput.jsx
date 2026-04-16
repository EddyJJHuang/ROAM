/**
 * ActivityInput – list of candidate activities loaded from the API.
 *
 * All activities participate in the optimization by default. This panel lets
 * the user opt out of activities they don't want considered (e.g. things
 * they're not interested in). The algorithm is still responsible for picking
 * the final subset under time and budget constraints.
 *
 * Props:
 *   activities       – array of activity objects from the API
 *   excluded         – Set<string> of activity IDs the user has opted out of
 *   onToggleExclude  – (activityId: string) => void
 *   groupSize        – number of group members (≥ 1), used only for the
 *                      informational "$X group" cost readout
 */
export default function ActivityInput({
  activities,
  excluded,
  onToggleExclude,
  groupSize = 1,
}) {
  if (!activities || activities.length === 0) {
    return (
      <div className="glass-card-sm p-6 text-center text-gray-400">
        <p className="text-sm">Loading activities…</p>
      </div>
    );
  }

  const includedCount = activities.length - excluded.size;

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="section-label">Activities</p>
        <p className="text-xs text-gray-400 tabular-nums">
          <span className="text-gray-200 font-medium">{includedCount}</span>
          <span className="text-gray-500"> / {activities.length} included</span>
        </p>
      </div>

      <p className="text-[11px] text-gray-500 -mt-1 leading-relaxed">
        All activities are considered by default. Click to <strong>exclude</strong>{' '}
        activities you don't want the optimizer to consider — the algorithm
        picks the best subset under your time and budget constraints.
      </p>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {activities.map((act) => {
          const isExcluded = excluded.has(act.id);
          const groupCost = act.cost * groupSize;
          return (
            <button
              key={act.id}
              id={`activity-toggle-${act.id}`}
              onClick={() => onToggleExclude(act.id)}
              aria-pressed={!isExcluded}
              title={
                isExcluded
                  ? 'Excluded — click to include again'
                  : 'Click to exclude from optimization'
              }
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all duration-200
                ${isExcluded
                  ? 'bg-white/[0.02] border border-white/[0.04] text-gray-600 opacity-60 hover:opacity-80'
                  : 'bg-indigo-500/15 border border-indigo-500/30 text-white hover:bg-indigo-500/20'}`}
            >
              <div className="flex flex-col min-w-0">
                <span className={`font-medium truncate ${isExcluded ? 'line-through decoration-gray-600' : ''}`}>
                  {act.name}
                </span>
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
