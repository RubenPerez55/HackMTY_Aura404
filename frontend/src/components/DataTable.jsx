import { useEffect, useState } from "react";
import { formatValue } from "./chartUtils.js";
export default function DataTable({ data }) {
  const [sort, setSort] = useState({ key: null, asc: true });
  const [page, setPage] = useState(0);
  const size = Math.max(1, Math.min(50, data.pageSize ?? 5));
  useEffect(() => { setPage(0); }, [data]);
  const column = data.columns.find(c => c.key === sort.key);
  const rows = [...data.rows].sort((a, b) => {
    if (!column) return 0;
    const x = a[column.key], y = b[column.key];
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    const difference = column.format === "date" ? new Date(x).getTime() - new Date(y).getTime() : typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es", { numeric: true });
    return (Number.isNaN(difference) ? 0 : difference) * (sort.asc ? 1 : -1);
  });
  const pages = Math.max(1, Math.ceil(rows.length / size)), currentPage = Math.min(page, pages - 1);
  const chooseSort = key => { setSort(s => ({ key, asc: s.key === key ? !s.asc : true })); setPage(0); };
  const cell = (value, c) => formatValue(value, c.format, c.currency ?? data.currency);
  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white min-w-0"><h3 className="p-4 pb-2 text-sm font-bold text-gray-900">{data.title}</h3><div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">{data.title}</caption><thead className="bg-gray-50 text-[10px] uppercase text-gray-400"><tr>{data.columns.map(c => <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 ${c.align === "right" ? "text-right" : ""}`} aria-sort={sort.key === c.key ? (sort.asc ? "ascending" : "descending") : "none"}>{c.sortable === false ? c.label : <button type="button" onClick={() => chooseSort(c.key)}>{c.label}{sort.key === c.key ? (sort.asc ? " ↑" : " ↓") : ""}</button>}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.slice(currentPage * size, (currentPage + 1) * size).map((row, i) => <tr key={row.id ?? i}>{data.columns.map(c => <td key={c.key} className={`whitespace-nowrap px-3 py-2.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{cell(row[c.key], c)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={data.columns.length} className="p-6 text-center text-gray-500">No hay datos para mostrar.</td></tr>}</tbody>{data.columns.some(c => c.total === "sum") && <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold"><tr>{data.columns.map((c, i) => <td key={c.key} className={`px-3 py-3 ${c.align === "right" ? "text-right" : ""}`}>{c.total === "sum" ? <><span className="sr-only">Total: </span>{cell(rows.reduce((n, r) => n + (typeof r[c.key] === "number" ? r[c.key] : 0), 0), c)}</> : i === 0 ? "Total" : ""}</td>)}</tr></tfoot>}</table></div>{pages > 1 && <div className="flex items-center justify-between border-t border-gray-100 p-3 text-xs text-gray-500"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="disabled:opacity-40">← Anterior</button><span>{currentPage + 1} de {pages}</span><button type="button" disabled={currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)} className="disabled:opacity-40">Siguiente →</button></div>}</section>;
}
