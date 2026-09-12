import { useState } from "react";
const money = (v, c = "MXN") => new Intl.NumberFormat("es-MX", { style: "currency", currency: c }).format(v ?? 0);

export default function TransactionList({ data }) {
  const [filter, setFilter] = useState("all");
  const categories = [...new Set(data.transactions.map((item) => item.category).filter(Boolean))];
  const rows = filter === "all" ? data.transactions : data.transactions.filter((item) => item.category === filter);
  return <section className="rounded-2xl border border-gray-200 bg-white p-4">
    <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-gray-900">{data.title}</h3>{categories.length > 1 && <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] text-gray-600"><option value="all">Todas</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>}</div>
    <div className="divide-y divide-gray-100">{rows.map((item) => <div key={item.id} className="flex items-center justify-between py-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><i className="fa-solid fa-receipt" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{item.description}</p><p className="text-[10px] text-gray-400">{item.date}{item.category ? ` · ${item.category}` : ""}</p></div></div><p className={`ml-2 text-sm font-bold ${item.amount > 0 ? "text-green-600" : "text-gray-900"}`}>{money(item.amount, data.currency)}</p></div>)}</div>
    {rows.length === 0 && <p className="py-4 text-center text-xs text-gray-400">No hay movimientos en esta categoría.</p>}
  </section>;
}
