import { useMemo } from "react";

/**
 * Componente LineGraph (A2UI: `line_graph` / `line_chart`).
 *
 * Gráfica de líneas en SVG puro (sin librerías pesadas externas) inspirada
 * en el monitoreo de anomalías y picos de consumo/gasto (boceto con ejes
 * cartesianos, flechas direccionales, oscilación de línea base y pico anómalo).
 *
 * Props en `data`:
 *  - title?: string (ej. "Tendencia de consumo diario")
 *  - subtitle?: string
 *  - points?: Array<{ label: string, value: number, isAnomaly?: boolean }>
 *  - baseline?: number (valor promedio o de referencia)
 *  - baselineLabel?: string (ej. "Consumo habitual")
 *  - anomalyValue?: number (monto del pico si no viene en points)
 *  - anomalyLabel?: string (ej. "Sobrecosto CFE" o "Urgencia médica")
 *  - currency?: string (default "MXN")
 */
export default function LineGraph({ data = {} }) {
  const {
    title = "Monitoreo de consumo y tendencia",
    subtitle,
    baseline: rawBaseline,
    baselineLabel = "Promedio habitual",
    currency = "MXN",
    anomalyLabel = "Pico detectado",
  } = data;

  // Normalizar puntos o generar serie continua a partir de baseline y pico
  const { points, baselineValue } = useMemo(() => {
    let pts = Array.isArray(data.points) && data.points.length > 0 ? [...data.points] : null;
    let base = rawBaseline;

    // Si vienen puntos explícitos pero son muy pocos (ej. 2 o 3), o si no vienen puntos:
    // generamos una serie con oscilación natural y el pico característico del boceto
    if (!pts || pts.length < 5) {
      const spikeVal =
        data.anomalyValue ||
        pts?.find((p) => p.isAnomaly)?.value ||
        (pts && pts.length > 0 ? Math.max(...pts.map((p) => p.value || 0)) : 18500);

      const baseVal =
        base ||
        pts?.find((p) => !p.isAnomaly)?.value ||
        Math.round(spikeVal * 0.35);

      base = baseVal;

      // 26 puntos a lo largo del eje X con el pico centrado alrededor del punto 8 (35% del tiempo)
      const generated = [];
      const totalPoints = 26;
      const spikeIndex = 8;

      for (let i = 0; i < totalPoints; i++) {
        let val = baseVal;
        // Ruido y fluctuación orgánica de línea base (+/- 8% a 15%)
        const jitter = Math.sin(i * 1.7) * (baseVal * 0.12) + Math.cos(i * 2.3) * (baseVal * 0.08);
        val += jitter;

        // Formar el pico pronunciado del boceto
        if (i === spikeIndex) {
          val = spikeVal;
        } else if (i === spikeIndex - 1) {
          val = baseVal + (spikeVal - baseVal) * 0.45;
        } else if (i === spikeIndex + 1) {
          val = baseVal + (spikeVal - baseVal) * 0.38;
        } else if (i === spikeIndex + 2) {
          val = baseVal + (spikeVal - baseVal) * 0.15;
        }

        generated.push({
          label: `Día ${i + 1}`,
          value: Math.max(0, Math.round(val)),
          isAnomaly: i === spikeIndex,
        });
      }
      pts = generated;
    }

    if (!base) {
      const normalPts = pts.filter((p) => !p.isAnomaly);
      base = normalPts.length > 0
        ? Math.round(normalPts.reduce((acc, p) => acc + p.value, 0) / normalPts.length)
        : Math.round(Math.min(...pts.map((p) => p.value)));
    }

    return {
      points: pts,
      baselineValue: base,
    };
  }, [data, rawBaseline]);

  // Dimensiones SVG
  const width = 340;
  const height = 150;
  const padding = { top: 28, right: 18, bottom: 26, left: 24 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...points.map((p) => p.value), baselineValue * 1.2, 1);
  const minValue = Math.min(...points.map((p) => p.value), 0);
  const valueRange = maxValue - minValue || 1;

  // Coordenadas calculadas para cada punto
  const coords = useMemo(() => {
    return points.map((p, index) => {
      const x = padding.left + (index / (points.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - ((p.value - minValue) / valueRange) * graphHeight;
      return { ...p, x, y };
    });
  }, [points, minValue, valueRange, graphWidth, graphHeight, padding.left, padding.top]);

  // Construir comando de trazado SVG
  const linePath = useMemo(() => {
    if (coords.length === 0) return "";
    return coords.reduce((acc, c, idx) => {
      return idx === 0 ? `M ${c.x.toFixed(1)} ${c.y.toFixed(1)}` : `${acc} L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
    }, "");
  }, [coords]);

  // Área sombreada bajo la curva
  const areaPath = useMemo(() => {
    if (coords.length === 0) return "";
    const first = coords[0];
    const last = coords[coords.length - 1];
    const bottomY = padding.top + graphHeight;
    return `${linePath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
  }, [coords, linePath, padding.top, graphHeight]);

  // Y de la línea base
  const baselineY = padding.top + graphHeight - ((baselineValue - minValue) / valueRange) * graphHeight;

  // Coordenadas del pico anómalo
  const anomalyCoord = coords.find((c) => c.isAnomaly) || coords.reduce((max, c) => (c.value > max.value ? c : max), coords[0]);

  // Cálculo de diferencia porcentual para la leyenda
  const percentOver = baselineValue > 0 && anomalyCoord
    ? Math.round(((anomalyCoord.value - baselineValue) / baselineValue) * 100)
    : 0;

  return (
    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 shadow-sm">
      {/* Cabecera del gráfico */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EB0029] animate-pulse" />
            <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">{title}</p>
          </div>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {percentOver > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-[#EB0029]">
            +{percentOver}% vs habitual
          </span>
        )}
      </div>

      {/* Lienzo SVG con ejes y flechas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* Gradiente para el área bajo la curva */}
            <linearGradient id="spikeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EB0029" stopOpacity="0.28" />
              <stop offset="70%" stopColor="#EB0029" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#EB0029" stopOpacity="0.0" />
            </linearGradient>

            {/* Marcador de flecha para los ejes (estilo dibujo técnico) */}
            <marker
              id="axisArrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4B5563" />
            </marker>
          </defs>

          {/* Eje Y con flecha superior ↑ */}
          <line
            x1={padding.left}
            y1={padding.top + graphHeight + 4}
            x2={padding.left}
            y2={8}
            stroke="#4B5563"
            strokeWidth="1.75"
            markerEnd="url(#axisArrow)"
          />

          {/* Eje X con flecha lateral → */}
          <line
            x1={padding.left - 4}
            y1={padding.top + graphHeight}
            x2={width - 4}
            y2={padding.top + graphHeight}
            stroke="#4B5563"
            strokeWidth="1.75"
            markerEnd="url(#axisArrow)"
          />

          {/* Línea horizontal de referencia (Baseline / Promedio Habitual) */}
          {baselineValue > 0 && (
            <g>
              <line
                x1={padding.left}
                y1={baselineY}
                x2={width - padding.right}
                y2={baselineY}
                stroke="#9CA3AF"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.8"
              />
              <text
                x={width - padding.right}
                y={baselineY - 4}
                textAnchor="end"
                className="text-[9px] fill-gray-400 font-medium"
              >
                {baselineLabel} (${baselineValue.toLocaleString()})
              </text>
            </g>
          )}

          {/* Área sombreada degradada */}
          <path d={areaPath} fill="url(#spikeGradient)" />

          {/* Línea continua con fluctuación y pico anómalo */}
          <path
            d={linePath}
            fill="none"
            stroke="#1F2937"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Resaltado del Pico Anómalo */}
          {anomalyCoord && (
            <g>
              {/* Círculo pulsante animado */}
              <circle
                cx={anomalyCoord.x}
                cy={anomalyCoord.y}
                r="7"
                className="fill-[#EB0029] opacity-30 animate-ping"
              />
              {/* Punto central rojo Banorte */}
              <circle
                cx={anomalyCoord.x}
                cy={anomalyCoord.y}
                r="4.5"
                className="fill-[#EB0029] stroke-white stroke-[2]"
              />

              {/* Etiqueta flotante tipo badge sobre el pico */}
              <g transform={`translate(${anomalyCoord.x}, ${anomalyCoord.y - 12})`}>
                <rect
                  x="-38"
                  y="-18"
                  width="76"
                  height="16"
                  rx="4"
                  className="fill-gray-900"
                />
                <polygon
                  points="0,-2 -4,-6 4,-6"
                  className="fill-gray-900"
                />
                <text
                  x="0"
                  y="-6.5"
                  textAnchor="middle"
                  className="text-[9px] fill-white font-bold tracking-tight"
                >
                  ${anomalyCoord.value.toLocaleString()} {currency}
                </text>
              </g>
            </g>
          )}

          {/* Leyendas de los ejes */}
          <text
            x={padding.left + 4}
            y={12}
            className="text-[8px] fill-gray-500 font-semibold uppercase tracking-wider"
          >
            Monto ({currency})
          </text>
          <text
            x={width - 8}
            y={padding.top + graphHeight + 14}
            textAnchor="end"
            className="text-[8px] fill-gray-500 font-semibold uppercase tracking-wider"
          >
            Tiempo (días)
          </text>
        </svg>
      </div>

      {/* Pie descriptivo del gráfico */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#EB0029]" />
          <span>{anomalyLabel}: <strong className="text-gray-800">${anomalyCoord?.value.toLocaleString()} {currency}</strong></span>
        </div>
        {baselineValue > 0 && (
          <span className="text-gray-400">
            Nivel habitual: ${baselineValue.toLocaleString()} {currency}
          </span>
        )}
      </div>
    </div>
  );
}
