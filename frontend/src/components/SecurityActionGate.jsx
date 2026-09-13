import { useState } from "react";

// Gatillo de ejecución transaccional (RF-04.1): muestra el resumen de lo
// que se va a autorizar y, al confirmar, despliega su propio panel de
// SoftToken 2FA -- es el único punto de la pantalla que dispara una
// acción real contra el backend (`onConfirm`, async).
export default function SecurityActionGate({ data, pending, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isBusy = loading || pending;

  const handleConfirm = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Ingresa un código válido de 6 dígitos.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onConfirm?.(code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-2xl p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
        {data.summaryBadge}
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-[#EB0029] text-white font-semibold py-3 rounded-2xl mt-1"
        >
          {data.actionLabel}
        </button>
      ) : (
        <div className="mt-2">
          <p className="text-xs text-gray-300 mb-2">Confirma con tu SoftToken</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            disabled={isBusy}
            className="w-full text-center text-2xl tracking-[0.5em] font-bold border border-gray-700 bg-gray-800 text-white rounded-xl py-3 mb-2"
          />
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <button
            onClick={handleConfirm}
            disabled={isBusy}
            className="w-full bg-[#EB0029] disabled:bg-gray-600 text-white font-semibold py-3 rounded-2xl mb-2 flex items-center justify-center gap-2"
          >
            {isBusy ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin" />
                Procesando...
              </>
            ) : (
              "Confirmar"
            )}
          </button>
          {!isBusy && (
            <button
              onClick={() => {
                setOpen(false);
                setCode("");
                setError("");
              }}
              className="w-full text-gray-400 text-sm py-1"
            >
              Cancelar (no se moverá ningún fondo)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
