import { useState } from "react";

function formatValue(v, format) {
  if (format === "currency") return `$${Math.round(v).toLocaleString()}`;
  if (format === "percent") return `${Math.round(v)}%`;
  return Math.round(v).toLocaleString();
}

// Slider interactivo (plazos/montos) que recalcula en vivo -- del lado
// del CLIENTE, sin ida y vuelta al backend (spec.md RF-03: instantáneo).
//
// Hoy solo soportamos una fórmula: "lo que falta por cubrir" =
// `basis - value` (p. ej. sobrecosto menos puntos redimidos). Se
// recalcula únicamente la PRIMERA entrada de `calculations` -- si el
// agente manda más entradas, se muestran tal cual llegaron (estáticas)
// hasta que se necesite una fórmula distinta (instalments, etc.).
export default function DynamicValueSlider({ data, onChange }) {
  const [value, setValue] = useState(data.value);

  const handleChange = (raw) => {
    const next = Number(raw);
    setValue(next);
    onChange?.(next);
  };

  const primary = data.calculations?.[0];
  const primaryValue =
    primary && typeof data.basis === "number" ? Math.max(0, data.basis - value) : primary?.value;

  return (
    <div>
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        {data.unitLabel}
      </label>
      <input
        type="range"
        min={data.min}
        max={data.max}
        step={data.step}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full accent-[#EB0029] my-2"
      />
      <p className="text-xs text-gray-500 mb-3">
        {formatValue(value, "currency")} de {formatValue(data.max, "currency")}
      </p>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${data.calculations.length}, 1fr)` }}>
        {data.calculations.map((calc, i) => (
          <div key={calc.label} className="bg-red-50 rounded-2xl p-3 text-center">
            <p className="text-[10px] text-gray-500">{calc.label}</p>
            <p className="text-lg font-black text-gray-900">
              {formatValue(i === 0 ? primaryValue : calc.value, calc.format)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
