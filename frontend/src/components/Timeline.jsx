import { useState, useMemo } from 'react';

/**
 * Timeline – SVG Gantt-chart showing Greedy vs DP Optimal schedules.
 *
 * Props
 * ─────
 *   greedyResult  – { selected, timeline, total_value, total_cost, budget_remaining }
 *   optimalResult – same shape
 *   config        – { day_start, day_end, slot_minutes, total_slots, … }
 *   travelTimes   – raw travel-time adjacency matrix
 */

/* ── Location → colour palette ────────────────────────────────── */
const LOC_COLORS = {
  bellagio:      { bg: '#7c3aed', fg: '#ede9fe', border: '#8b5cf6' },  // violet
  caesars:       { bg: '#6366f1', fg: '#e0e7ff', border: '#818cf8' },  // indigo
  venetian_area: { bg: '#2563eb', fg: '#dbeafe', border: '#60a5fa' },  // blue
  linq:          { bg: '#0891b2', fg: '#cffafe', border: '#22d3ee' },  // cyan
  mgm:           { bg: '#059669', fg: '#d1fae5', border: '#34d399' },  // emerald
  strip_south:   { bg: '#16a34a', fg: '#dcfce7', border: '#4ade80' },  // green
  downtown:      { bg: '#d97706', fg: '#fef3c7', border: '#fbbf24' },  // amber
  off_strip:     { bg: '#dc2626', fg: '#fee2e2', border: '#f87171' },  // red
};
const DEFAULT_COLOR = { bg: '#475569', fg: '#e2e8f0', border: '#94a3b8' };
const colorFor = (loc) => LOC_COLORS[loc] || DEFAULT_COLOR;

/* ── Layout constants ─────────────────────────────────────────── */
const LABEL_W     = 100;   // left gutter width for row labels
const SLOT_W      = 28;    // pixel width per 30-min slot
const ROW_H       = 54;    // height of each swimlane
const ROW_GAP     = 14;    // gap between the two rows
const HEADER_H    = 28;    // time-axis header height
const PADDING_X   = 16;
const PADDING_TOP  = 8;
const PADDING_BOT  = 12;
const TRAVEL_H    = 6;     // height of travel-time indicator bars

export default function Timeline({ greedyResult, optimalResult, config, travelTimes }) {
  const [selected, setSelected] = useState(null); // clicked activity detail

  /* ── Bail if no results yet ─────────────────────────────────── */
  if (!greedyResult && !optimalResult) {
    return (
      <div className="glass-card-sm p-10 text-center text-gray-500 text-sm">
        Run the optimizer to see the schedule timeline.
      </div>
    );
  }

  const totalSlots = config?.total_slots ?? 32;
  const slotMin    = config?.slot_minutes ?? 30;

  /* ── Build hour labels ──────────────────────────────────────── */
  const startHour = 8; // day_start = "08:00"
  const hourLabels = [];
  for (let s = 0; s <= totalSlots; s += 2) {
    const h = startHour + (s * slotMin) / 60;
    hourLabels.push({ slot: s, label: `${Math.floor(h)}:${(h % 1) * 60 === 0 ? '00' : '30'}` });
  }

  const chartW   = totalSlots * SLOT_W;
  const svgW     = LABEL_W + chartW + PADDING_X * 2;
  const svgH     = PADDING_TOP + HEADER_H + ROW_H * 2 + ROW_GAP + PADDING_BOT;
  const row1Y    = PADDING_TOP + HEADER_H;
  const row2Y    = row1Y + ROW_H + ROW_GAP;

  /* ── Compute IDs for difference highlight ───────────────────── */
  const greedyIds  = new Set((greedyResult?.selected ?? []).map((a) => a.id));
  const optimalIds = new Set((optimalResult?.selected ?? []).map((a) => a.id));

  /* ── Travel segments ────────────────────────────────────────── */
  const travelSegments = (timeline) => {
    if (!timeline || timeline.length < 2) return [];
    const segs = [];
    for (let i = 0; i < timeline.length - 1; i++) {
      const a = timeline[i].activity;
      const b = timeline[i + 1].activity;
      const travelMin = travelTimes?.[a.location_id]?.[b.location_id] ?? 0;
      if (travelMin > 0) {
        segs.push({
          fromSlot: a.end_slot,
          toSlot: b.start_slot,
          fromLoc: a.location_id,
          toLoc: b.location_id,
          minutes: travelMin,
        });
      }
    }
    return segs;
  };

  const greedyTravel  = travelSegments(greedyResult?.timeline);
  const optimalTravel = travelSegments(optimalResult?.timeline);

  /* ── Summary stats helper ───────────────────────────────────── */
  const summaryFor = (result) => {
    if (!result) return null;
    const totalDurationSlots = result.selected.reduce((s, a) => s + (a.end_slot - a.start_slot), 0);
    const freeSlots = totalSlots - totalDurationSlots;
    return {
      count: result.selected.length,
      cost: result.total_cost,
      value: result.total_value,
      freeHrs: ((freeSlots * slotMin) / 60).toFixed(1),
    };
  };

  const greedySummary  = summaryFor(greedyResult);
  const optimalSummary = summaryFor(optimalResult);

  /* ── Render an activity bar ─────────────────────────────────── */
  const ActivityBar = ({ act, rowY, isUnique }) => {
    const c = colorFor(act.location_id);
    const x = LABEL_W + act.start_slot * SLOT_W;
    const w = (act.end_slot - act.start_slot) * SLOT_W;
    const barH = ROW_H - 14;
    const y = rowY + 7;

    return (
      <g
        className="cursor-pointer"
        onClick={() => setSelected(selected?.id === act.id ? null : act)}
      >
        <rect
          x={x} y={y} width={w} height={barH} rx={8}
          fill={c.bg}
          stroke={isUnique ? '#facc15' : c.border}
          strokeWidth={isUnique ? 2 : 1}
          strokeDasharray={isUnique ? '5 3' : 'none'}
          opacity={0.92}
        />
        {/* Activity name (clipped) */}
        <clipPath id={`clip-${act.id}-${rowY}`}>
          <rect x={x + 4} y={y} width={w - 8} height={barH} />
        </clipPath>
        <text
          x={x + 6} y={y + 15}
          fill={c.fg} fontSize={11} fontWeight={600} fontFamily="Inter, sans-serif"
          clipPath={`url(#clip-${act.id}-${rowY})`}
        >
          {act.name}
        </text>
        <text
          x={x + 6} y={y + 28}
          fill={c.fg} fontSize={9} opacity={0.7} fontFamily="Inter, sans-serif"
          clipPath={`url(#clip-${act.id}-${rowY})`}
        >
          {act.time_range} · ${act.cost}
        </text>
        {/* Hover highlight */}
        <rect
          x={x} y={y} width={w} height={barH} rx={8}
          fill="white" opacity={0}
          className="transition-opacity duration-150 hover:!opacity-[0.08]"
        />
      </g>
    );
  };

  /* ── Render travel segment bar ──────────────────────────────── */
  const TravelBar = ({ seg, rowY }) => {
    const x = LABEL_W + seg.fromSlot * SLOT_W;
    const w = Math.max((seg.toSlot - seg.fromSlot) * SLOT_W, 4);
    const y = rowY + ROW_H - TRAVEL_H - 3;

    return (
      <g>
        <rect x={x} y={y} width={w} height={TRAVEL_H} rx={3} fill="#475569" opacity={0.5} />
        {/* Tooltip via <title> */}
        <title>{`${seg.fromLoc} → ${seg.toLoc}: ${seg.minutes} min`}</title>
        {w > 20 && (
          <text x={x + w / 2} y={y + TRAVEL_H - 1} textAnchor="middle"
                fontSize={7} fill="#94a3b8" fontFamily="Inter, sans-serif">
            {seg.minutes}m
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <p className="section-label">Schedule Timeline</p>

      {/* ── SVG Chart ──────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-1 px-1">
        <svg
          width={svgW} height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="block select-none"
          style={{ minWidth: svgW }}
        >
          {/* ── Background ──────────────────────────────────── */}
          <rect width={svgW} height={svgH} rx={12} fill="#111827" opacity={0.4} />

          {/* ── Hour gridlines + labels ─────────────────────── */}
          {hourLabels.map(({ slot, label }) => {
            const x = LABEL_W + slot * SLOT_W;
            return (
              <g key={slot}>
                <line
                  x1={x} y1={PADDING_TOP + HEADER_H - 4}
                  x2={x} y2={svgH - PADDING_BOT}
                  stroke="#374151" strokeWidth={0.5}
                />
                <text
                  x={x} y={PADDING_TOP + HEADER_H - 8}
                  textAnchor="middle" fill="#6b7280" fontSize={9} fontFamily="Inter, sans-serif"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* ── Row bg strips ───────────────────────────────── */}
          <rect x={LABEL_W} y={row1Y} width={chartW} height={ROW_H} rx={8} fill="#1f2937" opacity={0.35} />
          <rect x={LABEL_W} y={row2Y} width={chartW} height={ROW_H} rx={8} fill="#1f2937" opacity={0.35} />

          {/* ── Row labels ──────────────────────────────────── */}
          <text x={PADDING_X} y={row1Y + ROW_H / 2 + 1} dominantBaseline="middle"
                fill="#fbbf24" fontSize={11} fontWeight={700} fontFamily="Inter, sans-serif">
            Greedy
          </text>
          <text x={PADDING_X} y={row2Y + ROW_H / 2 + 1} dominantBaseline="middle"
                fill="#34d399" fontSize={11} fontWeight={700} fontFamily="Inter, sans-serif">
            Optimal
          </text>

          {/* ── Greedy activities ───────────────────────────── */}
          {greedyResult?.timeline?.map(({ activity }) => (
            <ActivityBar
              key={`g-${activity.id}`}
              act={activity}
              rowY={row1Y}
              isUnique={!optimalIds.has(activity.id)}
            />
          ))}

          {/* ── Optimal activities ──────────────────────────── */}
          {optimalResult?.timeline?.map(({ activity }) => (
            <ActivityBar
              key={`o-${activity.id}`}
              act={activity}
              rowY={row2Y}
              isUnique={!greedyIds.has(activity.id)}
            />
          ))}

          {/* ── Travel segments ─────────────────────────────── */}
          {greedyTravel.map((seg, i) => (
            <TravelBar key={`gt-${i}`} seg={seg} rowY={row1Y} />
          ))}
          {optimalTravel.map((seg, i) => (
            <TravelBar key={`ot-${i}`} seg={seg} rowY={row2Y} />
          ))}
        </svg>
      </div>

      {/* ── Legend ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
        {Object.entries(LOC_COLORS).map(([loc, c]) => (
          <span key={loc} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c.bg }} />
            {loc.replace(/_/g, ' ')}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="inline-block w-4 h-2.5 rounded-sm border-2 border-dashed border-yellow-400 bg-transparent" />
          unique to row
        </span>
      </div>

      {/* ── Summary cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Greedy', data: greedySummary, color: 'text-amber-400' },
          { label: 'Optimal', data: optimalSummary, color: 'text-emerald-400' },
        ].map(({ label, data, color }) =>
          data ? (
            <div key={label} className="glass-card-sm px-4 py-3 flex items-center justify-between text-xs">
              <span className={`font-bold ${color}`}>{label}</span>
              <div className="flex gap-3 text-gray-400 tabular-nums">
                <span>{data.count} acts</span>
                <span>${data.cost}</span>
                <span>val {data.value.toFixed(1)}</span>
                <span>{data.freeHrs}h free</span>
              </div>
            </div>
          ) : null,
        )}
      </div>

      {/* ── Detail popover ─────────────────────────────────── */}
      {selected && (
        <div className="glass-card p-4 space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">{selected.name}</h3>
              <p className="text-xs text-gray-400">
                {selected.time_range} · {selected.location_id.replace(/_/g, ' ')} · ${selected.cost}/person
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-500 hover:text-white text-lg leading-none transition"
            >
              ×
            </button>
          </div>

          {/* Member ratings */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(selected.ratings || {}).map(([member, score]) => (
              <span
                key={member}
                className={`px-2 py-0.5 rounded-md text-xs font-semibold
                  ${score >= 8
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : score <= 3
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-white/[0.07] text-gray-300'}`}
              >
                {member}: {score}
              </span>
            ))}
          </div>

          {/* Average */}
          {selected.ratings && (
            <p className="text-xs text-gray-500">
              Average:{' '}
              <span className="text-white font-bold">
                {(
                  Object.values(selected.ratings).reduce((a, b) => a + b, 0) /
                  Object.values(selected.ratings).length
                ).toFixed(1)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
