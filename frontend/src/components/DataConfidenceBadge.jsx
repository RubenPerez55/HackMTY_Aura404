const styles = { verified: "bg-emerald-50 text-emerald-700", estimated: "bg-amber-50 text-amber-700", incomplete: "bg-gray-100 text-gray-600" };
const labels = { verified: "Datos confirmados", estimated: "Estimación", incomplete: "Información incompleta" };
export default function DataConfidenceBadge({ data }) {
  const status = data.status ?? "verified";
  return <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] ${styles[status] ?? styles.incomplete}`} role="status"><i className={`fa-solid ${status === "verified" ? "fa-circle-check" : status === "estimated" ? "fa-calculator" : "fa-circle-info"} mt-0.5`} /><div><p className="font-semibold">{data.label ?? labels[status]}</p>{data.source && <p className="mt-0.5 opacity-80">{data.source}</p>}{data.note && <p className="mt-0.5 opacity-80">{data.note}</p>}</div></div>;
}
