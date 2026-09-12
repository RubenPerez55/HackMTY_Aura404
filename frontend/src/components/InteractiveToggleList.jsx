// Lista de comercios/suscripciones con interruptor para domiciliar (ej.
// exentar la anualidad de tarjeta). Todavía no está conectada a ningún
// escenario -- el caso de "anualidad de tarjeta" es una demo aparte,
// pendiente de definir (ver conversación del equipo). Se deja lista en
// el catálogo para cuando se diseñe ese caso.
export default function InteractiveToggleList({ data, onToggle }) {
  return (
    <div className="space-y-2">
      {data.items.map((item) => (
        <label
          key={item.id}
          className="flex items-center justify-between bg-gray-50 rounded-xl p-3"
        >
          <div>
            <p className="text-sm font-semibold text-gray-800">{item.name}</p>
            <p className="text-[10px] text-gray-400">
              ${item.amount.toLocaleString()} · hoy vía {item.currentPaymentMethod}
            </p>
          </div>
          <input
            type="checkbox"
            checked={item.isSelected}
            onChange={() => onToggle?.(item.id)}
            className="w-5 h-5 accent-[#EB0029]"
          />
        </label>
      ))}
    </div>
  );
}
