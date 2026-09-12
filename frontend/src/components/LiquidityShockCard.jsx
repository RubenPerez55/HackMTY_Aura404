import { useState } from "react";

// RF-01.3 + RF-03.3 — golpe de liquidez. El slider de plazos recalcula
// en vivo la liquidez recuperada y la cuota mensual fija.
export default function LiquidityShockCard({ data, onConfirm }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const plan = data.planOptions[selectedIndex];
  const projectedBalance = data.currentBalance + data.transactionAmount;

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
        Componente generado · liquidity_shock_card
      </p>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        Este cargo dejó tu saldo bajo
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Faltan {data.daysUntilPayroll} días para tu próxima nómina
      </p>

      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">Saldo actual</span>
          <span className="font-semibold text-gray-900">
            ${data.currentBalance.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Si difieres este cargo</span>
          <span className="font-semibold text-green-600">
            ${projectedBalance.toLocaleString()}
          </span>
        </div>
      </div>

      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        Plazo a diferir
      </label>
      <input
        type="range"
        min={0}
        max={data.planOptions.length - 1}
        step={1}
        value={selectedIndex}
        onChange={(e) => setSelectedIndex(Number(e.target.value))}
        className="w-full accent-[#EB0029] my-2"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mb-4">
        {data.planOptions.map((p) => (
          <span key={p.months}>{p.months} meses</span>
        ))}
      </div>

      <div className="bg-red-50 rounded-2xl p-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Cuota mensual</span>
          <span className="text-xl font-black text-gray-900">
            ${plan.monthlyPayment.toLocaleString()}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">{plan.note}</p>
      </div>

      <button
        onClick={() =>
          onConfirm({
            actionSummary: `Diferir cargo a ${plan.months} meses (cuota de $${plan.monthlyPayment}/mes).`,
          })
        }
        className="w-full bg-[#EB0029] text-white font-semibold py-3 rounded-2xl"
      >
        Aplicar plan de {plan.months} meses
      </button>
    </div>
  );
}
