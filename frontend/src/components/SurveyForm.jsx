import { useState } from "react";

export default function SurveyForm({ data, onSubmit }) {
  const [values, setValues] = useState(() => Object.fromEntries((data.fields ?? []).map((f) => [f.name, f.value ?? ""])));
  const [error, setError] = useState("");
  const update = (name, value) => {
    const field = (data.fields ?? []).find((item) => item.name === name);
    if (field && ["number", "currency"].includes(field.type) && value !== "") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      if (field.max != null && numeric > field.max) value = String(field.max);
      if (field.min != null && numeric < field.min) value = String(field.min);
    }
    setValues((current) => ({ ...current, [name]: value }));
  };
  const submit = (event) => {
    event.preventDefault();
    const missing = (data.fields ?? []).find((field) => field.required && String(values[field.name] ?? "").trim() === "");
    if (missing) { setError(`Completa: ${missing.label}.`); return; }
    const invalid = (data.fields ?? []).find((field) => {
      if (!["number", "currency"].includes(field.type) || values[field.name] === "") return false;
      const value = Number(values[field.name]);
      return !Number.isFinite(value) || (field.min != null && value < field.min) || (field.max != null && value > field.max);
    });
    if (invalid) { setError(`${invalid.label} está fuera del rango permitido.`); return; }
    setError("");
    onSubmit?.({ action: data.submitActionId ?? "submit_survey", actionSummary: data.submitSummary ?? data.submitLabel, values });
  };
  return <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
    <div><h3 className="text-sm font-bold text-gray-900">{data.title}</h3>{data.description && <p className="mt-1 text-xs text-gray-500">{data.description}</p>}</div>
    {(data.fields ?? []).map((field) => <label key={field.name} className="block"><span className="text-xs font-semibold text-gray-600">{field.label}{field.required && <span className="text-[#EB0029]"> *</span>}</span>{field.type === "select" ? <select value={values[field.name] ?? ""} onChange={(e) => update(field.name, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="">Selecciona una opción</option>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.type === "currency" ? "number" : field.type} value={values[field.name] ?? ""} onChange={(e) => update(field.name, e.target.value)} min={field.min} max={field.max} placeholder={field.placeholder} inputMode={field.type === "number" || field.type === "currency" ? "decimal" : undefined} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />}</label>)}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    <button type="submit" className="w-full rounded-xl bg-[#EB0029] py-2.5 text-sm font-semibold text-white">{data.submitLabel}</button>
  </form>;
}
