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

  if (surface.children && surface.children.length > 0) {
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

  // Si la raíz es surface_root pero children llegó vacío o nulo,
  // NO debemos mandar a resolveComponent("surface_root") porque caería en GenericJsonView.
  // En su lugar, si hay datos en surface.data, montamos ComposedScreen infiriendo los componentes.
  if (surface.component === "surface_root" && surface.data && typeof surface.data === "object") {
    const inferredChildren = Object.entries(surface.data)
      .filter(([id, val]) => id !== "/" && val && typeof val === "object")
      .map(([id, data]) => {
        let component = "generic";
        if (data.currentValue !== undefined || data.baselineLabel !== undefined) {
          component = "metric_delta_header";
        } else if (Array.isArray(data.options)) {
          component = "solution_matrix_selector";
        } else if (Array.isArray(data.items)) {
          component = "interactive_toggle_list";
        } else if (data.actionLabel !== undefined) {
          component = "security_action_gate";
        } else if (Array.isArray(data.bars)) {
          component = "trend_history_chart";
        } else if (data.min !== undefined && data.max !== undefined) {
          component = "dynamic_value_slider";
        }
        return { id, component, data };
      });

    if (inferredChildren.length > 0) {
      return (
        <ComposedScreen
          key={surface.surfaceId}
          userName={userName}
          title={surface.title || "Solución Personalizada Banorte"}
          children={inferredChildren}
          onConfirm={onConfirm}
        />
      );
    }
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
