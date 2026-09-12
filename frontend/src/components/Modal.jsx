// Modal generico: envuelve cualquier componente A2UI que se muestre
// como resultado de tocar el AlertBanner.
//
// Vive DENTRO del marco del "telefono" simulado (App.jsx le da
// `position: relative` a ese contenedor) -- por eso es `absolute inset-0`
// y no `fixed inset-0`: asi queda recortado por el `overflow-hidden` y
// las esquinas redondeadas del telefono, y se siente como una pantalla
// nativa deslizandose ahi adentro, no como un dialogo de escritorio
// tapando toda la ventana del navegador.
export default function Modal({ open, onClose, children }) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[92%] overflow-y-auto">
        {/* Handle de "hoja" nativa (bottom sheet) */}
        <div className="flex justify-center pt-2">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex justify-end px-3 pt-1 pb-1 sticky top-0 bg-white">
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
