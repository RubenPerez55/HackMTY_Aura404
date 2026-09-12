import { useState } from "react";

// RF-04.1 + caso límite E-02 (código inválido no reinicia el flujo).
// Genérico: cualquiera de las tres tarjetas de solución lo usa antes de
// ejecutar la acción real.
export default function TwoFactorModal({ actionSummary, onSubmit, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Ingresa un código válido de 6 dígitos.");
      return;
    }
    // Demo: cualquier código de 6 dígitos se acepta.
    setError("");
    onSubmit();
  };

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
        Componente generado · two_factor_modal
      </p>
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        Confirma con tu SoftToken
      </h2>
      <p className="text-sm text-gray-600 mb-4">{actionSummary}</p>

      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="w-full text-center text-2xl tracking-[0.5em] font-bold border border-gray-200 rounded-xl py-3 mb-2"
      />
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <button
        onClick={handleSubmit}
        className="w-full bg-[#EB0029] text-white font-semibold py-3 rounded-2xl mb-2"
      >
        Confirmar
      </button>
      <button
        onClick={onCancel}
        className="w-full text-gray-500 text-sm py-2"
      >
        Cancelar (no se moverá ningún fondo)
      </button>
    </div>
  );
}
