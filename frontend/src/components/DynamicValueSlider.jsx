import { useState } from "react";

function formatValue(v, format) {
  if (format === "currency" || format === "MXN" || format === "$") return `$${Math.round(v).toLocaleString()}`;
  if (format === "percent" || format === "%") return `${Math.round(v)}%`;
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
// `inactiveLabel`: cuando el slider está ligado a UNA opción de
// solution_matrix_selector (ver `data.appliesToOptionId` en
// ComposedScreen.jsx) y el usuario seleccionó otra, no tiene sentido
// mostrarlo como si fuera a recalcular algo -- se muestra deshabilitado
// con una nota, en vez de fingir que sigue "vivo".
export default function DynamicValueSlider({ data, onChange, inactiveLabel }) {
  const [value, setValue] = useState(data.value);
  const isPoints = /punto|pts/i.test(data.unitLabel || "");

  if (inactiveLabel) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-4 opacity-60">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {data.unitLabel}
        </label>
        <input type="range" disabled className="w-full my-2" value={data.value} readOnly />
        <p className="text-xs text-gray-400">{inactiveLabel}</p>
      </div>
    );
  }

  const handleChange = (raw) => {
    const next = Number(raw);
    setValue(next);
    onChange?.(next);
  };

  const computeCalcValue = (calc, i) => {
    if (isPoints) {
      const bonificacion = value / 10;
      const label = (calc.label || "").toLowerCase();
      if (label.includes("bonificaci") || label.includes("ahorro") || label.includes("descuento")) {
        return bonificacion;
      }
      if (label.includes("porcentaje") || label.includes("%") || label.includes("cubierto")) {
        const basis = data.basis || 1500;
        return basis > 0 ? Math.min(100, Math.round((bonificacion / basis) * 100)) : 100;
      }
      if (label.includes("restante") || label.includes("cargo") || label.includes("falta") || label.includes("neto")) {
        const basis = data.basis || 1500;
        return Math.max(0, basis - bonificacion);
      }
    }
    if (i === 0 && typeof data.basis === "number" && (calc.label || "").toLowerCase().includes("cubrir")) {
      return Math.max(0, data.basis - value);
    }
    return calc.value;
  };

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
        {isPoints
          ? `${Math.round(value).toLocaleString()} pts de ${Math.round(data.max).toLocaleString()} pts disponibles`
          : `${formatValue(value, "currency")} de ${formatValue(data.max, "currency")}`}
      </p>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${data.calculations.length}, 1fr)` }}>
        {data.calculations.map((calc, i) => (
          <div key={calc.label} className="bg-red-50 rounded-2xl p-3 text-center">
            <p className="text-[10px] text-gray-500">{calc.label}</p>
            <p className="text-lg font-black text-gray-900">
              {formatValue(computeCalcValue(calc, i), calc.format)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
