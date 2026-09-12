const money = (value, currency = "MXN") => new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(value ?? 0);

export default function BalanceCard({ data }) {
  return <section className="rounded-2xl bg-gray-900 p-4 text-white shadow-sm">
    <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-gray-400">{data.title}</p><i className="fa-solid fa-wallet text-red-400" /></div>
    <p className="mt-2 text-3xl font-black">{money(data.availableBalance, data.currency)}</p>
    <p className="text-xs text-gray-400">Saldo disponible</p>
    {(data.creditLimit != null || data.currentDebt != null) && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-700 pt-3 text-xs">
      {data.creditLimit != null && <div><p className="text-gray-400">Límite</p><p className="font-bold">{money(data.creditLimit, data.currency)}</p></div>}
      {data.currentDebt != null && <div><p className="text-gray-400">Deuda actual</p><p className="font-bold">{money(data.currentDebt, data.currency)}</p></div>}
    </div>}
  </section>;
}
