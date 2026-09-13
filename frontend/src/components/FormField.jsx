import { useEffect, useState } from "react";
export default function FormField({ data, onValueChange }) {
  const [value, setValue] = useState(data.value ?? "");
  const [error, setError] = useState("");
  useEffect(() => setValue(data.value ?? ""), [data.value]);
  const update = (next) => {
    if (data.type === "number" || data.type === "currency") {
      const numeric = Number(next);
      if (next !== "" && !Number.isFinite(numeric)) return;
      if (next !== "" && data.min != null && numeric < data.min) { setError(`El mínimo es ${data.min}.`); return; }
      if (next !== "" && data.max != null && numeric > data.max) { setError(`El máximo es ${data.max}.`); return; }
    }
    setError(""); setValue(next); onValueChange?.(data.name, next);
  };
  const classes = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#EB0029]";
  return <label className="block"><span className="text-xs font-bold text-gray-600">{data.label}{data.required && <span className="text-[#EB0029]"> *</span>}</span>{data.type === "select" ? <select value={value} onChange={(e) => update(e.target.value)} className={classes}><option value="">Selecciona una opción</option>{(data.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input type={data.type === "currency" ? "number" : data.type} value={value} onChange={(e) => update(e.target.value)} placeholder={data.placeholder} min={data.min} max={data.max} required={data.required} inputMode={data.type === "number" || data.type === "currency" ? "decimal" : undefined} className={classes} />}{(error || data.helperText) && <span className={`mt-1 block text-[10px] ${error ? "text-red-600" : "text-gray-400"}`}>{error || data.helperText}</span>}</label>;
}
