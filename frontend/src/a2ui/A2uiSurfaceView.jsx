import { resolveComponent } from "../components/componentRegistry.js";
import ComposedScreen from "./ComposedScreen.jsx";

/**
 * Puente entre el runtime A2UI (reducer.js) y el component registry.
 * Toma una surface YA RESUELTA (resolveSurface / listSurfaces) y monta:
 *
 *  - `surface.children` presente -> pantalla COMPUESTA: varios
 *    componentes reales, montados en orden por ComposedScreen.jsx.
 *  - si no -> un solo componente (compatibilidad hacia atrás con
 *    escenarios de un solo nodo, p. ej. confirmation_receipt o los
 *    escenarios legacy que todavía no se rediseñan).
 *
 * `onCancel` es opcional: solo lo usan componentes de un solo nodo con
 * una acción de "cancelar" propia (legacy: two_factor_modal). Los demás
 * simplemente lo ignoran como prop extra.
 */
export default function A2uiSurfaceView({ surface, userName, onConfirm, onCancel }) {
  if (!surface) return null;

  if (surface.children) {
    return (
      <ComposedScreen
        key={surface.surfaceId}
        userName={userName}
        title={surface.title}
        children={surface.children}
        onConfirm={onConfirm}
      />
    );
  }

  const Component = resolveComponent(surface.component);
  const handleAction = (payload) => onConfirm?.(payload);
  return (
    <div>
      <Component data={surface.data} onConfirm={onConfirm} onAction={handleAction} onCancel={onCancel} />
      <p className="text-center text-[10px] text-gray-300 pt-1">
        Componente generado tras análisis de LLM
      </p>
    </div>
  );
}
