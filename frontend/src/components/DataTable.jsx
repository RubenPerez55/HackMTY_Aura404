import { useState } from "react";
const display = (value) => value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
export default function DataTable({ data }) {
  const [sort, setSort] = useState({ key: null, asc: true });
  const [page, setPage] = useState(0);
  const size = data.pageSize ?? 5;
  const rows = [...data.rows].sort((a, b) => !sort.key ? 0 : String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "es", { numeric: true }) * (sort.asc ? 1 : -1));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const chooseSort = (key) => { setSort((s) => ({ key, asc: s.key === key ? !s.asc : true })); setPage(0); };
  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white"><h3 className="p-4 pb-2 text-sm font-bold text-gray-900">{data.title}</h3><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase text-gray-400"><tr>{data.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2"><button onClick={() => c.sortable !== false && chooseSort(c.key)}>{c.label}{sort.key === c.key ? (sort.asc ? " ↑" : " ↓") : ""}</button></th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.slice(page * size, page * size + size).map((row, i) => <tr key={row.id ?? i}>{data.columns.map((c) => <td key={c.key} className={`whitespace-nowrap px-3 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>{display(row[c.key])}</td>)}</tr>)}</tbody></table></div>{pages > 1 && <div className="flex items-center justify-between border-t border-gray-100 p-3 text-[10px] text-gray-500"><button disabled={page === 0} onClick={() => setPage(page - 1)}>← Anterior</button><span>{page + 1} de {pages}</span><button disabled={page + 1 === pages} onClick={() => setPage(page + 1)}>Siguiente →</button></div>}</section>;
}
