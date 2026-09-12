import { useState, useEffect } from "react";

function formatValue(v, format) {
  if (format === "currency" || format === "MXN" || format === "$") return `$${Math.round(v).toLocaleString()}`;
  if (format === "percent" || format === "%") return `${Math.round(v)}%`;
  return Math.round(v).toLocaleString();
}

// Slider interactivo (plazos/montos) que recalcula en vivo -- del lado
// del CLIENTE, sin ida y vuelta al backend (spec.md RF-03: instantáneo).
export default function DynamicValueSlider({ data, onChange, inactiveLabel }) {
  const [value, setValue] = useState(data.value);

  useEffect(() => {
    setValue(data.value);
  }, [data.value]);

  const isPoints = /punto|pts/i.test(data.unitLabel || "");
  const isMonths = /mes|plazo/i.test(data.unitLabel || "");

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
      if (
        label.includes("restante") ||
        label.includes("cargo") ||
        label.includes("falta") ||
        label.includes("neto") ||
        label.includes("liquidar") ||
        label.includes("pagar")
      ) {
        const basis = data.basis || 1500;
        return Math.max(0, basis - bonificacion);
      }
    }

    if (isMonths) {
      const months = value || 1;
      const basis = typeof data.basis === "number" ? data.basis : 1500;
      const label = (calc.label || "").toLowerCase();
      if (label.includes("cuota") || label.includes("mensual") || label.includes("pago") || label.includes("fija")) {
        return Number((basis / months).toFixed(2));
      }
      if (label.includes("liquidez") || label.includes("recuperad") || label.includes("restaurad") || label.includes("inmediat")) {
        return basis;
      }
      if (label.includes("plazo") || label.includes("mes")) {
        return months;
      }
      if (label.includes("inter") || label.includes("tasa") || label.includes("%")) {
        return 0;
      }
      if (label.includes("total")) {
        return basis;
      }
    }

    if (i === 0 && typeof data.basis === "number" && (calc.label || "").toLowerCase().includes("cubrir")) {
      return Math.max(0, data.basis - value);
    }
    return calc.value;
  };

  const calculationsList = data.calculations || [];

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 transition-all duration-200 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          {data.unitLabel}
        </label>
        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
          {isPoints ? `${Math.round(value).toLocaleString()} pts` : isMonths ? `${value} meses` : formatValue(value, "currency")}
        </span>
      </div>
      <input
        type="range"
        min={data.min}
        max={data.max}
        step={data.step}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full accent-[#EB0029] my-2 cursor-pointer"
      />
      <p className="text-[11px] text-gray-500 mb-3">
        {isPoints
          ? `${Math.round(value).toLocaleString()} pts de ${Math.round(data.max).toLocaleString()} pts disponibles ($${(data.max / 10).toLocaleString()} MXN max)`
          : isMonths
          ? `Diferir a ${value} meses sin intereses (plazo de ${data.min} a ${data.max} meses)`
          : `${formatValue(value, "currency")} de ${formatValue(data.max, "currency")}`}
      </p>

      {calculationsList.length > 0 && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${calculationsList.length}, 1fr)` }}
        >
          {calculationsList.map((calc, i) => (
            <div key={calc.label || i} className="bg-white border border-red-100 rounded-xl p-2.5 text-center shadow-xs">
              <p className="text-[10px] text-gray-500 font-medium">{calc.label}</p>
              <p className="text-base font-black text-gray-900 mt-0.5">
                {formatValue(computeCalcValue(calc, i), calc.format)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
