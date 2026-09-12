// RF-04.2 — confirmación final. Tras esto, el AlertBanner original debe
// retirarse del dashboard (lo maneja App.jsx).
export default function ConfirmationReceipt({ folio, actionDescription, onClose }) {
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
      <p className="text-sm text-gray-600 mb-4">{actionDescription}</p>
      <p className="text-xs text-gray-400 mb-6">Folio: {folio}</p>
      <button
        onClick={onClose}
        className="w-full bg-gray-900 text-white font-semibold py-3 rounded-2xl"
      >
        Volver al inicio
      </button>
    </div>
  );
}
