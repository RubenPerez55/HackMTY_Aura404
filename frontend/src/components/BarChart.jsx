import ChartFrame from "./ChartFrame.jsx";
import { CHART_COLORS, chartDomain, formatValue } from "./chartUtils.js";
export default function BarChart({ data }) {
  const labels = data.labels ?? [], series = data.series ?? [], stacked = data.mode === "stacked";
  const totals = labels.flatMap((_, i) => [series.reduce((n, s) => n + Math.max(0, s.values[i] ?? 0), 0), series.reduce((n, s) => n + Math.min(0, s.values[i] ?? 0), 0)]);
  const [min, max] = chartDomain(stacked ? totals : series.flatMap(s => s.values).filter(v => v != null));
  const width = Math.max(540, labels.length * 70 + 90), plotWidth = width - 90, slot = plotWidth / Math.max(1, labels.length);
  const y = v => 190 - (v - min) / (max - min) * 160;
  return <ChartFrame data={data} series={series} rows={labels.map((label, i) => ({ label, values: series.map(s => s.values[i]) }))}>
    <div className="mt-4 overflow-x-auto"><svg viewBox={`0 0 ${width} 235`} style={{ minWidth: Math.max(300, labels.length * 70 + 90) }} className="w-full" role="img" aria-label={data.title}>
      {[min, (min + max) / 2, max].map((v, i) => <g key={i}><line x1="70" x2={width - 20} y1={y(v)} y2={y(v)} stroke="#E5E7EB" /><text x="65" y={y(v) + 4} textAnchor="end" fontSize="9" fill="#6B7280">{formatValue(v, data.format, data.currency)}</text></g>)}
      <line x1="70" x2={width - 20} y1={y(0)} y2={y(0)} stroke="#9CA3AF" />
      {labels.map((label, i) => { let positive = 0, negative = 0; return <g key={i}>{series.map((s, j) => {
        const v = s.values[i]; if (v == null) return null;
        const start = stacked ? (v >= 0 ? positive : negative) : 0;
        if (v >= 0) positive += v; else negative += v;
        const barWidth = slot * .72 / (stacked ? 1 : series.length);
        return <rect key={j} x={70 + i * slot + slot * .14 + (stacked ? 0 : j * barWidth)} y={Math.min(y(start), y(start + v))} width={Math.max(1, barWidth - 2)} height={Math.abs(y(start) - y(start + v))} fill={CHART_COLORS[j % 6]} fillOpacity={s.isProjected ? .45 : 1} stroke={s.isProjected ? CHART_COLORS[j % 6] : "none"} strokeDasharray={s.isProjected ? "4 3" : undefined}><title>{`${label} · ${s.label}: ${formatValue(v, data.format, data.currency)}`}</title></rect>;
      })}<text x={70 + (i + .5) * slot} y="214" textAnchor="middle" fontSize="10" fill="#6B7280">{label.length > 12 ? `${label.slice(0, 11)}…` : label}</text></g>; })}
    </svg></div>
  </ChartFrame>;
}
