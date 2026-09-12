import { useState } from "react";

// Lista interactiva de servicios candidatos para domiciliación (spec.md RF-01.2, RF-03.2).
// Permite al usuario conmutar qué servicios domiciliar y recalcula en vivo
// la exención de la anualidad a $0.00 MXN en el cliente.
export default function InteractiveToggleList({ data, onChange, onToggle, inactiveLabel, disabled }) {
  const [selectedIds, setSelectedIds] = useState(() => {
    const initial = new Set();
    data?.items?.forEach((item) => {
      if (item.isSelected) initial.add(item.id);
    });
    return initial;
  });

  if (inactiveLabel) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-4 opacity-60">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
          Servicios para domiciliación
        </p>
        <p className="text-xs text-gray-500">{inactiveLabel}</p>
      </div>
    );
  }

  const handleToggle = (id) => {
    if (disabled) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const selectedItems = (data?.items || []).filter((item) => next.has(item.id));
      onChange?.(selectedItems);
      onToggle?.(id);
      return next;
    });
  };

  const count = selectedIds.size;
  const isExempt = count >= 1;

  return (
    <div className="space-y-3">
      {/* Indicador en vivo de exención de anualidad (spec.md RF-03.2) */}
      <div
        className={`rounded-2xl p-3.5 border transition-all duration-300 ${
          isExempt
            ? "bg-emerald-50/80 border-emerald-200"
            : "bg-amber-50/80 border-amber-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isExempt ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
            <div>
              <p
                className={`text-xs font-bold ${
                  isExempt ? "text-emerald-900" : "text-amber-900"
                }`}
              >
                {isExempt
                  ? `Exención 100% garantizada (${count} servicio${count > 1 ? "s" : ""})`
                  : "Cobro ordinario de anualidad"}
              </p>
              <p
                className={`text-[10px] ${
                  isExempt ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {isExempt
                  ? "Condonación total a $0.00 MXN al formalizar con SoftToken"
                  : "Selecciona al menos 1 servicio recurrente para exentar"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-sm font-black ${
                isExempt ? "text-emerald-700" : "text-amber-900"
              }`}
            >
              {isExempt ? "$0.00 MXN" : "$1,500.00 MXN"}
            </span>
            {isExempt && (
              <span className="block text-[9px] text-emerald-600 line-through">
                $1,500.00
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lista interactiva de servicios candidatos */}
      <div className="space-y-2">
        {(data?.items || []).map((item) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              onClick={() => handleToggle(item.id)}
              className={`flex items-center justify-between rounded-xl p-3 border transition-all cursor-pointer select-none ${
                isSelected
                  ? "bg-red-50/60 border-red-200 shadow-sm"
                  : "bg-gray-50/70 border-gray-100 hover:bg-gray-100/70"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isSelected
                      ? "bg-[#EB0029] text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  <i className="fa-solid fa-receipt" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 leading-tight">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    ${item.amount.toLocaleString()} MXN/mes · hoy vía{" "}
                    {item.currentPaymentMethod || item.currentPaymentPaymentMethod || "Pago manual"}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="w-5 h-5 accent-[#EB0029] rounded cursor-pointer"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
