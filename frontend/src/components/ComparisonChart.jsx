import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
  PieChart, Pie, ResponsiveContainer,
} from 'recharts';

/**
 * ComparisonChart – Recharts-powered Greedy vs DP comparison dashboard.
 *
 * Props
 * ─────
 *   greedyResult  – solver result object
 *   optimalResult – solver result object
 *   comparison    – { value_difference, greedy_is_optimal, activities_only_in_greedy, activities_only_in_optimal }
 *   budget        – total budget ($) for utilisation calculation
 */

const AMBER  = '#fbbf24';
const EMERALD = '#34d399';
const SLATE   = '#475569';
const ROSE    = '#fb7185';

/* ── Custom Recharts tooltip ──────────────────────────────────── */
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-card-sm px-3 py-2 text-xs space-y-0.5">
      <p className="font-semibold text-white">{d.name}</p>
      <p className="text-gray-400">Value: <span className="text-white font-bold">{d.value.toFixed(1)}</span></p>
    </div>
  );
};

const BudgetTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-sm px-3 py-2 text-xs">
      <p className="text-white font-semibold">{payload[0].name}: ${payload[0].value}</p>
    </div>
  );
};

export default function ComparisonChart({ comparison, greedyResult, optimalResult, budget }) {
  /* ── Empty state ────────────────────────────────────────────── */
  if (!comparison || !greedyResult || !optimalResult) {
    return (
      <div className="glass-card-sm p-10 text-center text-gray-500 text-sm">
        No results yet — run the optimizer first.
      </div>
    );
  }

  const greedy  = greedyResult;
  const optimal = optimalResult;

  /* ── Derived metrics ────────────────────────────────────────── */
  const pctImprovement = greedy.total_value > 0
    ? ((comparison.value_difference / greedy.total_value) * 100).toFixed(1)
    : '0.0';

  const greedyUtil  = budget > 0 ? ((greedy.total_cost / budget) * 100).toFixed(0) : 0;
  const optimalUtil = budget > 0 ? ((optimal.total_cost / budget) * 100).toFixed(0) : 0;

  /* ── Chart data ─────────────────────────────────────────────── */
  const barData = [
    { name: 'Greedy',  value: greedy.total_value,  fill: AMBER },
    { name: 'Optimal', value: optimal.total_value, fill: EMERALD },
  ];

  const greedyPie = [
    { name: 'Used',      value: greedy.total_cost },
    { name: 'Remaining', value: greedy.budget_remaining },
  ];
  const optimalPie = [
    { name: 'Used',      value: optimal.total_cost },
    { name: 'Remaining', value: optimal.budget_remaining },
  ];

  /* ── Activity diff lists ────────────────────────────────────── */
  const greedyMap  = Object.fromEntries(greedy.selected.map((a) => [a.id, a]));
  const optimalMap = Object.fromEntries(optimal.selected.map((a) => [a.id, a]));

  const commonIds     = greedy.selected.filter((a) => a.id in optimalMap).map((a) => a.id);
  const onlyGreedyIds = comparison.activities_only_in_greedy  || [];
  const onlyOptimalIds = comparison.activities_only_in_optimal || [];

  /* ────────────────────────────────────────────────────────────── */
  return (
    <div className="glass-card p-5 space-y-5">
      <p className="section-label">Algorithm Comparison</p>

      {/* ── Optimality banner ──────────────────────────────────── */}
      {comparison.greedy_is_optimal ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-center">
          <span className="text-emerald-400 font-bold text-sm">✨ Greedy achieved optimal! ✨</span>
          <p className="text-[11px] text-emerald-400/70 mt-0.5">
            The greedy heuristic found the globally optimal solution for this input.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 text-center">
          <span className="text-indigo-300 font-bold text-sm">
            DP found +{pctImprovement}% more satisfaction than Greedy
          </span>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Greedy Value"
          value={greedy.total_value.toFixed(1)}
          color="text-amber-400"
        />
        <KpiCard
          label="Optimal Value"
          value={optimal.total_value.toFixed(1)}
          color="text-emerald-400"
        />
        <KpiCard
          label="Activities"
          value={`${greedy.selected.length} vs ${optimal.selected.length}`}
          sub="greedy · optimal"
          color="text-indigo-300"
        />
        <KpiCard
          label="Budget Used"
          value={`${greedyUtil}% vs ${optimalUtil}%`}
          sub="greedy · optimal"
          color="text-violet-300"
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bar chart — satisfaction */}
        <div className="md:col-span-1 glass-card-sm p-4">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Satisfaction</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {!comparison.greedy_is_optimal && (
            <p className="text-center text-[10px] text-gray-500 mt-1">
              Δ = <span className="text-emerald-400 font-bold">+{comparison.value_difference.toFixed(1)}</span> satisfaction points
            </p>
          )}
        </div>

        {/* Pie charts — budget */}
        <div className="md:col-span-2 glass-card-sm p-4">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Budget Utilisation</p>
          <div className="grid grid-cols-2 gap-2">
            {/* Greedy pie */}
            <div>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={greedyPie} dataKey="value" cx="50%" cy="50%"
                    innerRadius={36} outerRadius={56} paddingAngle={3}
                    startAngle={90} endAngle={-270}
                    stroke="none"
                  >
                    <Cell fill={AMBER} />
                    <Cell fill="#1e293b" />
                  </Pie>
                  <Tooltip content={<BudgetTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-amber-400 font-bold -mt-1">Greedy</p>
              <p className="text-center text-[10px] text-gray-500">
                ${greedy.total_cost} / ${budget} ({greedyUtil}%)
              </p>
            </div>
            {/* Optimal pie */}
            <div>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={optimalPie} dataKey="value" cx="50%" cy="50%"
                    innerRadius={36} outerRadius={56} paddingAngle={3}
                    startAngle={90} endAngle={-270}
                    stroke="none"
                  >
                    <Cell fill={EMERALD} />
                    <Cell fill="#1e293b" />
                  </Pie>
                  <Tooltip content={<BudgetTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-emerald-400 font-bold -mt-1">Optimal</p>
              <p className="text-center text-[10px] text-gray-500">
                ${optimal.total_cost} / ${budget} ({optimalUtil}%)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Activity diff table ────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Activity Breakdown</p>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {/* Common */}
          {commonIds.map((id) => {
            const a = greedyMap[id] || optimalMap[id];
            return (
              <DiffRow key={id} act={a} tag="both" />
            );
          })}
          {/* Only in greedy */}
          {onlyGreedyIds.map((id) => {
            const a = greedyMap[id];
            return a ? <DiffRow key={id} act={a} tag="greedy" /> : null;
          })}
          {/* Only in optimal */}
          {onlyOptimalIds.map((id) => {
            const a = optimalMap[id];
            return a ? <DiffRow key={id} act={a} tag="optimal" /> : null;
          })}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="glass-card-sm p-3 text-center">
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums leading-tight ${color}`}>{value}</p>
      {sub && <p className="text-[9px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function DiffRow({ act, tag }) {
  const tagStyle = {
    both:    'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
    greedy:  'bg-rose-500/15 text-rose-300 border-rose-500/20',
    optimal: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  };
  const tagLabel = {
    both: 'Both',
    greedy: 'Greedy only',
    optimal: 'DP only',
  };

  const ratings  = act.ratings ? Object.values(act.ratings) : [];
  const avgScore = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '–';

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition text-xs">
      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${tagStyle[tag]}`}>
        {tagLabel[tag]}
      </span>
      <span className="flex-1 text-gray-300 font-medium truncate">{act.name}</span>
      <span className="text-gray-500 tabular-nums">{act.time_range}</span>
      <span className="text-gray-400 tabular-nums w-10 text-right">${act.cost}</span>
      <span className="text-indigo-300 tabular-nums w-8 text-right font-semibold">{avgScore}</span>
    </div>
  );
}
