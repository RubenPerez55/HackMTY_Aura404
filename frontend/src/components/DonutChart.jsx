import ChartFrame from "./ChartFrame.jsx";
import { CHART_COLORS, formatValue } from "./chartUtils.js";
export default function DonutChart({ data }) {
  const categories = data.categories ?? [], total = categories.reduce((n, c) => n + c.amount, 0);
  let offset = 0;
  return <ChartFrame showLegend={false} data={{ ...data, format: data.format ?? "currency" }} series={[{ label: "Monto" }]} rows={categories.map(c => ({ label: c.label, values: [c.amount] }))}>
    <div className="mt-4 flex flex-wrap items-center justify-center gap-4"><svg viewBox="0 0 200 200" className="w-44 shrink-0" role="img" aria-label={`${data.title}: ${formatValue(total, data.format ?? "currency", data.currency)}`}>
      <circle cx="100" cy="100" r="72" fill="none" stroke="#E5E7EB" strokeWidth="24" />
      {categories.map((c, i) => { const share = total ? c.amount / total * 100 : 0, start = offset; offset += share; return <circle key={i} cx="100" cy="100" r="72" fill="none" stroke={CHART_COLORS[i % 6]} strokeWidth="24" pathLength="100" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{`${c.label}: ${formatValue(c.amount, data.format ?? "currency", data.currency)} (${share.toFixed(1)}%)`}</title></circle>; })}
      <text x="100" y="95" textAnchor="middle" fontSize="11" fill="#6B7280">Total {data.currency ?? "MXN"}</text><text x="100" y="115" textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">{formatValue(total)}</text>
    </svg><ul className="flex-1 min-w-[160px] space-y-2 text-xs">{categories.map((c, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % 6] }} /><span className="break-words min-w-0 flex-1 text-gray-600">{c.label}</span><span className="text-right font-semibold text-gray-900">{formatValue(c.amount, data.format ?? "currency", data.currency)}<span className="block font-normal text-gray-500">{total ? (c.amount / total * 100).toFixed(1) : 0}%</span></span></li>)}</ul></div>
  </ChartFrame>;
}
