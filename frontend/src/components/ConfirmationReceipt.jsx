// RF-04.2 -- confirmación final. Igual que las demás tarjetas A2UI se
// monta con (data, onConfirm); aquí "onConfirm" significa "cerrar y
// retirar la alerta del dashboard" -- App.jsx es quien decide qué hacer
// con eso (nunca manda otro turno al agente: el ciclo terminó).
export default function ConfirmationReceipt({ data, onConfirm }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
        Componente generado · confirmation_receipt
      </p>
      <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto my-4">
        <i className="fa-solid fa-check text-2xl" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        Listo, tu quincena está a salvo
      </h2>
      <p className="text-sm text-gray-600 mb-4">{data.actionDescription}</p>
      <p className="text-xs text-gray-400 mb-6">Folio: {data.folio}</p>
      <button
        onClick={() => onConfirm(data)}
        className="w-full bg-gray-900 text-white font-semibold py-3 rounded-2xl"
      >
        Volver al inicio
      </button>
    </div>
  );
}
