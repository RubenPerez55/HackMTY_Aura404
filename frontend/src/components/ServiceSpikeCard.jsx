import { useState } from "react";

// RF-02.1 + RF-03.1 — pico de servicio recurrente (ej. CFE).
// El slider de puntos recalcula el cargo neto EN VIVO, del lado del
// cliente (spec.md pide que sea instantáneo, sin ida y vuelta al backend).
export default function ServiceSpikeCard({ data, onConfirm }) {
  const maxRedeemableMxn = Math.min(
    data.overageAmount,
    data.pointsAvailable * data.pointsToMxnRate
  );
  const [pointsMxn, setPointsMxn] = useState(maxRedeemableMxn);

  const netCharge = Math.max(0, data.overageAmount - pointsMxn);
  const pointsUsed = Math.round(pointsMxn / data.pointsToMxnRate);

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
        Componente generado · service_spike_card
      </p>
      <h2 className="text-lg font-bold text-gray-900 mb-3">
        Tu recibo de {data.service} salió más caro
      </h2>

      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">Tu promedio habitual</span>
          <span className="font-semibold text-gray-700">
            ${data.historicalAverage.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Este mes</span>
          <span className="font-semibold text-gray-900">
            ${data.currentAmount.toLocaleString()}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-2 bg-[#EB0029]"
            style={{
              width: `${Math.min(
                100,
                (data.currentAmount / data.historicalAverage) * 60
              )}%`,
            }}
          />
        </div>
        <p className="text-xs text-[#EB0029] font-semibold mt-2">
          Sobrecosto: ${data.overageAmount.toLocaleString()}
        </p>
      </div>

      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        Cubrir con Puntos Banorte
      </label>
      <input
        type="range"
        min={0}
        max={maxRedeemableMxn}
        step={1}
        value={pointsMxn}
        onChange={(e) => setPointsMxn(Number(e.target.value))}
        className="w-full accent-[#EB0029] my-2"
      />
      <p className="text-xs text-gray-500 mb-4">
        Usando {pointsUsed} pts (${pointsMxn.toFixed(0)} MXN) de{" "}
        {data.pointsAvailable} disponibles
      </p>

      <div className="bg-red-50 rounded-2xl p-4 mb-4 flex justify-between items-center">
        <span className="text-sm text-gray-600">Cargo neto a débito</span>
        <span className="text-xl font-black text-gray-900">
          ${netCharge.toFixed(0)}
        </span>
      </div>

      <button
        onClick={() =>
          onConfirm({
            actionSummary: `Aplicar ${pointsUsed} pts a tu recibo de ${data.service}. Cargo neto: $${netCharge.toFixed(
              0
            )}.`,
          })
        }
        className="w-full bg-[#EB0029] text-white font-semibold py-3 rounded-2xl"
      >
        Aplicar puntos y continuar
      </button>
    </div>
  );
}
