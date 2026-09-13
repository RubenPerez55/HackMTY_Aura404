export default function FinancialProgressVisual({ data }) {
  const current = Math.max(0, Number(data.current) || 0);
  const target = Math.max(1, Number(data.target) || 1);
  const percent = Math.min(100, Math.max(0, current / target * 100));
  const currency = data.currency ?? "MXN";
  const fmt = value => new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  return <section className="rounded-2xl bg-gray-50 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-gray-900">{data.title}</h3><span className="text-sm font-black text-[#EB0029]">{Math.round(percent)}%</span></div>{data.description && <p className="mt-1 text-xs text-gray-500">{data.description}</p>}<svg viewBox="0 0 320 92" className="mt-4 w-full" role="img" aria-label={`${data.title}: ${Math.round(percent)}%`}><rect x="10" y="30" width="300" height="18" rx="9" fill="#E5E7EB" /><rect x="10" y="30" width={300 * percent / 100} height="18" rx="9" fill="#EB0029" /><circle cx={10 + 300 * percent / 100} cy="39" r="8" fill="#EB0029" /><text x="10" y="70" fontSize="11" fill="#6B7280">{fmt(current)}</text><text x="310" y="70" textAnchor="end" fontSize="11" fill="#6B7280">Meta: {fmt(target)}</text></svg></section>;
}
