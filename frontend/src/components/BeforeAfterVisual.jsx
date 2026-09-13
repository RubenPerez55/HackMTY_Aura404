import { formatValue } from "./chartUtils.js";
export default function BeforeAfterVisual({ data }) {
  const values = [Number(data.before) || 0, Number(data.after) || 0];
  const max = Math.max(1, ...values);
  const fmt = value => formatValue(value, data.format ?? "currency", data.currency ?? "MXN");
  return <section className="rounded-2xl bg-gray-50 p-4"><h3 className="text-sm font-bold text-gray-900">{data.title}</h3>{data.description && <p className="mt-1 text-xs text-gray-500">{data.description}</p>}<div className="mt-4 grid grid-cols-2 gap-3"><div className="text-center"><div className="flex h-28 items-end justify-center"><div className="w-16 rounded-t-lg bg-gray-400" style={{ height: `${Math.max(8, values[0] / max * 100)}%` }} /></div><p className="mt-2 text-xs text-gray-500">{data.beforeLabel ?? "Antes"}</p><p className="text-sm font-bold text-gray-900">{fmt(values[0])}</p></div><div className="text-center"><div className="flex h-28 items-end justify-center"><div className="w-16 rounded-t-lg bg-[#EB0029]" style={{ height: `${Math.max(8, values[1] / max * 100)}%` }} /></div><p className="mt-2 text-xs text-gray-500">{data.afterLabel ?? "Después"}</p><p className="text-sm font-bold text-gray-900">{fmt(values[1])}</p></div></div></section>;
}
