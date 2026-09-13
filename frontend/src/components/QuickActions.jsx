export default function QuickActions() {
  const actions = [
    { icon: "arrow-right-arrow-left", label: "Transferir" },
    { icon: "money-bill-transfer", label: "Pagar" },
    { icon: "qrcode", label: "CoDi" },
    { icon: "hand-holding-dollar", label: "Retiro" },
  ];

  return (
    <section className="px-5 py-3">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
        Operaciones rápidas
      </h2>
      <div className="grid grid-cols-4 gap-3 text-center">
        {actions.map(({ icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex flex-col items-center group focus:outline-none transition-transform active:scale-95"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#EB0029] group-hover:bg-red-100 group-hover:shadow flex items-center justify-center shadow-xs transition-all duration-150">
              <i className={`fa-solid fa-${icon} text-lg`} />
            </div>
            <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium mt-2">
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
