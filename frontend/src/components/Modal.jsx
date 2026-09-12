// Modal genérico: envuelve cualquier componente A2UI que se muestre
// como resultado de tocar el AlertBanner. No tiene lógica de negocio.
export default function Modal({ open, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-end p-3 sticky top-0 bg-white">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
            aria-label="Cerrar"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
