import ChartFrame from "./ChartFrame.jsx";
import { CHART_COLORS, chartDomain, formatValue } from "./chartUtils.js";
export default function LineChart({ data }) {
  const labels = data.labels ?? [], series = data.series ?? [];
  const [min, max] = chartDomain(series.flatMap(s => s.values).filter(v => v != null));
  const x = i => 70 + i * 470 / Math.max(1, labels.length - 1);
  const y = v => 190 - (v - min) / (max - min) * 160;
  return <ChartFrame data={data} series={series} rows={labels.map((label, i) => ({ label, values: series.map(s => s.values[i]) }))}>
    <div className="overflow-x-auto mt-4"><svg viewBox="0 0 570 230" className="w-full min-w-[340px]" role="img" aria-label={data.title}>
      {[min, (min + max) / 2, max].map((v, i) => <g key={i}><line x1="70" x2="540" y1={y(v)} y2={y(v)} stroke="#E5E7EB" /><text x="65" y={y(v) + 4} textAnchor="end" fontSize="9" fill="#6B7280">{formatValue(v, data.format, data.currency)}</text></g>)}
      {series.map((s, j) => <g key={j}>{s.values.map((v, i) => v == null ? null : <g key={i}>{i > 0 && s.values[i - 1] != null && <line x1={x(i - 1)} y1={y(s.values[i - 1])} x2={x(i)} y2={y(v)} stroke={CHART_COLORS[j % 6]} strokeWidth="2.5" strokeDasharray={s.isProjected ? "6 4" : undefined} />}<circle cx={x(i)} cy={y(v)} r="3.5" fill={CHART_COLORS[j % 6]}><title>{`${labels[i]} · ${s.label}: ${formatValue(v, data.format, data.currency)}`}</title></circle></g>)}</g>)}
      {labels.map((label, i) => (i % Math.max(1, Math.ceil(labels.length / 6)) === 0 || i === labels.length - 1) && <text key={i} x={x(i)} y="214" textAnchor="middle" fontSize="10" fill="#6B7280">{label.length > 12 ? `${label.slice(0, 11)}…` : label}</text>)}
    </svg></div>
  </ChartFrame>;
}
