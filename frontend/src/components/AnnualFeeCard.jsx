import { useState } from "react";

// RF-01.2 + RF-03.2 — anualidad por vencer, exentable domiciliando un
// servicio. Los switches recalculan en vivo el costo final de la
// anualidad (hacia $0 si se activa al menos un servicio elegible).
export default function AnnualFeeCard({ data, onConfirm }) {
  const [enrolled, setEnrolled] = useState(() =>
    Object.fromEntries(data.eligibleServices.map((s) => [s.id, false]))
  );

  const anyEnrolled = Object.values(enrolled).some(Boolean);
  const finalFee = anyEnrolled ? 0 : data.feeAmount;

  const toggle = (id) =>
    setEnrolled((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
        Componente generado · annual_fee_card
      </p>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        Tu anualidad se cobra pronto
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Vence el {new Date(data.dueDate).toLocaleDateString("es-MX")}
      </p>

      <div className="space-y-2 mb-4">
        {data.eligibleServices.map((service) => (
          <label
            key={service.id}
            className="flex items-center justify-between bg-gray-50 rounded-xl p-3"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {service.label}
              </p>
              <p className="text-[10px] text-gray-400">
                ${service.monthlyAmount}/mes · domiciliar
              </p>
            </div>
            <input
              type="checkbox"
              checked={enrolled[service.id]}
              onChange={() => toggle(service.id)}
              className="w-5 h-5 accent-[#EB0029]"
            />
          </label>
        ))}
      </div>

      <div className="bg-red-50 rounded-2xl p-4 mb-4 flex justify-between items-center">
        <span className="text-sm text-gray-600">Costo final de anualidad</span>
        <span className="text-xl font-black text-gray-900">
          ${finalFee.toFixed(0)}
        </span>
      </div>
      {anyEnrolled && (
        <p className="text-xs text-green-600 font-semibold mb-4">
          Anualidad exenta por domiciliación activa
        </p>
      )}

      <button
        disabled={!anyEnrolled}
        onClick={() =>
          onConfirm({
            actionSummary: `Domiciliar servicio(s) seleccionado(s) y exentar anualidad de $${data.feeAmount}.`,
          })
        }
        className="w-full bg-[#EB0029] disabled:bg-gray-300 text-white font-semibold py-3 rounded-2xl"
      >
        Confirmar domiciliación
      </button>
    </div>
  );
}
