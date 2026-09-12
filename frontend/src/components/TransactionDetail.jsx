const money = (v, c = "MXN") => new Intl.NumberFormat("es-MX", { style: "currency", currency: c }).format(v ?? 0);
export default function TransactionDetail({ data }) {
  const details = [["Fecha", data.date], ["Categoría", data.category], ["Referencia", data.reference], ["Método", data.paymentMethod]].filter(([, value]) => value);
  return <section className="rounded-2xl bg-gray-50 p-4"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Detalle del movimiento</p><h3 className="mt-1 text-base font-bold text-gray-900">{data.merchant}</h3></div><p className="text-lg font-black text-gray-900">{money(data.amount, data.currency)}</p></div><dl className="mt-4 space-y-2 border-t border-gray-200 pt-3">{details.map(([label, value]) => <div key={label} className="flex justify-between text-xs"><dt className="text-gray-400">{label}</dt><dd className="font-semibold text-gray-700">{value}</dd></div>)}</dl></section>;
}
