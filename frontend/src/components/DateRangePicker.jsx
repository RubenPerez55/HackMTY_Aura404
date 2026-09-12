import { useState } from "react";
export default function DateRangePicker({ data, onValueChange }) {
  const [range, setRange] = useState({ startDate: data.startDate ?? "", endDate: data.endDate ?? "" });
  const update = (key, value) => { const next = { ...range, [key]: value }; setRange(next); onValueChange?.(data.name ?? "dateRange", next); };
  return <fieldset className="rounded-2xl bg-gray-50 p-4"><legend className="text-xs font-bold uppercase tracking-wider text-gray-400">{data.label}</legend><div className="mt-2 grid grid-cols-2 gap-2">{[["startDate", "Desde"], ["endDate", "Hasta"]].map(([key, label]) => <label key={key} className="text-[10px] text-gray-500">{label}<input type="date" value={range[key]} min={data.minDate} max={data.maxDate} onChange={(e) => update(key, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs" /></label>)}</div></fieldset>;
}
