// Gráfica de barras (histórico de consumo, o proyección pre/post-acción).
// Hecha a mano con divs (sin librería de charts) -- barra anómala en
// rojo, barra proyectada con borde punteado, el resto en gris.
export default function TrendHistoryChart({ data }) {
  const max = Math.max(...data.bars.map((b) => b.amount), 1);

  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <div className="flex items-end justify-between gap-2 h-28">
        {data.bars.map((bar, i) => {
          const heightPct = Math.max(6, (bar.amount / max) * 100);
          const colorClass = bar.isAnomaly
            ? "bg-[#EB0029]"
            : bar.isProjected
              ? "bg-gray-300 border-2 border-dashed border-gray-400"
              : "bg-gray-300";
          return (
            <div key={`${bar.label}-${i}`} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[9px] text-gray-500 mb-1">
                {data.currency}
                {Math.round(bar.amount).toLocaleString()}
              </span>
              <div
                className={`w-full rounded-t-md ${colorClass}`}
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-[9px] text-gray-400 mt-1 truncate max-w-full">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
