// Selector de tarjetas de solución (ej. "Puntos Banorte" vs. otras
// opciones futuras). La selección es 100% local/cliente -- no dispara
// ninguna llamada al backend, solo afecta qué opción queda resaltada
// (y, potencialmente, qué parámetros usa dynamic_value_slider).
const ICONS = {
  points: "fa-coins",
  installments: "fa-calendar-days",
  domiciliation: "fa-repeat",
  default: "fa-circle-check",
};

export default function SolutionMatrixSelector({ data, selectedId, onSelect }) {
  const current = selectedId ?? data.selectedId;

  return (
    <div className="space-y-2">
      {data.options.map((option) => {
        const isSelected = option.id === current;
        const isRecommended = Boolean(option.recommended || /recomendad/i.test(option.tag || ""));
        // Si el tag es una repetición de "Recomendado", no mostrarlo a la derecha
        const hasCustomTag = option.tag && !/recomendad/i.test(option.tag);

        return (
          <button
            key={option.id}
            onClick={() => onSelect?.(option.id)}
            className={`w-full text-left rounded-2xl p-3 flex items-center gap-3 border transition ${
              isSelected
                ? "border-[#EB0029] bg-red-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isSelected ? "bg-[#EB0029] text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              <i className={`fa-solid ${ICONS[option.iconName] || ICONS.default}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-800">{option.title}</p>
                {isRecommended && (
                  <span className="text-[9px] font-bold uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    Recomendado
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{option.subtitle}</p>
            </div>
            {hasCustomTag && (
              <span className="text-[10px] text-gray-400 whitespace-nowrap">{option.tag}</span>
            )}
            {isSelected && <i className="fa-solid fa-circle-check text-[#EB0029] shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
