// Gráfica de barras (histórico de consumo, o proyección pre/post-acción).
// Hecha a mano con divs (sin librería de charts) -- barra anómala en
// rojo, barra proyectada con borde punteado, el resto en gris.
//
// El "motivo de la gráfica" (por qué se le muestra al usuario) se
// calcula 100% en el cliente a partir de `bars` -- no depende de que el
// LLM mande un texto aparte (que a veces olvida): si hay una barra
// marcada `isAnomaly`, se compara contra la primera barra "normal" y se
// arma una leyenda tipo "Este mes: $X vs. tu promedio de $Y -- +Z%".
function buildCaption(bars, currency) {
  const anomaly = bars.find((b) => b.isAnomaly);
  const baseline = bars.find((b) => !b.isAnomaly && !b.isProjected);
  if (!anomaly || !baseline || baseline.amount <= 0) return null;
  const pct = Math.round(((anomaly.amount - baseline.amount) / baseline.amount) * 100);
  const sign = pct >= 0 ? "+" : "";
  return (
    `${anomaly.label}: ${currency}${Math.round(anomaly.amount).toLocaleString()} vs. ` +
    `${baseline.label.toLowerCase()}: ${currency}${Math.round(baseline.amount).toLocaleString()} ` +
    `(${sign}${pct}%).`
  );
}

export default function TrendHistoryChart({ data }) {
  const max = Math.max(...data.bars.map((b) => b.amount), 1);
  const caption = buildCaption(data.bars, data.currency);

  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <div className="flex items-end justify-between gap-3 h-28">
        {data.bars.map((bar, i) => {
          const heightPct = Math.max(6, Math.min(100, (bar.amount / max) * 100));
          const colorClass = bar.isAnomaly
            ? "bg-[#EB0029]"
            : bar.isProjected
              ? "bg-gray-300 border-2 border-dashed border-gray-400"
              : "bg-gray-300";
          return (
            <div key={`${bar.label}-${i}`} className="flex-1 flex flex-col items-center h-full">
              <span className="text-[10px] font-medium text-gray-500 mb-1 shrink-0">
                {data.currency}
                {Math.round(bar.amount).toLocaleString()}
              </span>
              <div className="w-full flex-1 flex items-end justify-center">
                <div
                  className={`w-full rounded-t-md ${colorClass} transition-all duration-300`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 mt-1 truncate max-w-full text-center shrink-0">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
      {caption && <p className="text-[11px] text-gray-500 mt-3 text-center">{caption}</p>}
    </div>
  );
}
