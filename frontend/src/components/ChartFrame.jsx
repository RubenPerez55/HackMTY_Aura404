import { CHART_COLORS, formatValue } from "./chartUtils.js";
export default function ChartFrame({ data, series = [], children, rows = [], showLegend = true }) {
  return <section className="rounded-2xl bg-gray-50 p-4 min-w-0">
    <h3 className="text-sm font-bold text-gray-900">{data.title}</h3>
    {data.subtitle && <p className="mt-1 text-xs text-gray-500">{data.subtitle}</p>}
    {rows.length ? <>{children}{showLegend && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">{series.map((s, i) => <span key={i} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{s.label}{s.isProjected ? " (proyección)" : ""}</span>)}</div>}
      <details className="mt-3 text-xs text-gray-500"><summary className="cursor-pointer">Ver valores</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-left"><caption className="sr-only">{data.title}</caption><thead><tr><th className="p-2">Periodo / categoría</th>{series.map((s, i) => <th className="p-2" key={i}>{s.label}{s.isProjected ? " (proyección)" : ""}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}><th className="p-2 font-normal">{r.label}</th>{r.values.map((v, j) => <td className="p-2" key={j}>{formatValue(v, data.format, data.currency)}</td>)}</tr>)}</tbody></table></div></details></> : <p className="py-6 text-center text-xs text-gray-500">No hay datos para mostrar.</p>}
  </section>;
}
