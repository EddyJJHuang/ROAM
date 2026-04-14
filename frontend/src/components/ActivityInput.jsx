/**
 * ActivityInput – displays the preset activity list loaded from the API.
 * Users can toggle individual activities on/off for the optimization run.
 *
 * Props:
 *   activities  – array of activity objects from the API
 *   selected    – Set<string> of currently-selected activity IDs
 *   onToggle    – (activityId: string) => void
 */
export default function ActivityInput({ activities, selected, onToggle }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="glass-card-sm p-6 text-center text-gray-400">
        <p className="text-sm">Loading activities…</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <p className="section-label">Activities</p>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {activities.map((act) => {
          const isOn = selected.has(act.id);
          return (
            <button
              key={act.id}
              id={`activity-toggle-${act.id}`}
              onClick={() => onToggle(act.id)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all duration-200
                ${isOn
                  ? 'bg-indigo-500/15 border border-indigo-500/30 text-white'
                  : 'bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:bg-white/[0.06]'}`}
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{act.name}</span>
                <span className="text-xs text-gray-500">{act.time_range} &middot; {act.location_id}</span>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums">
                {act.cost === 0 ? 'FREE' : `$${act.cost}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
