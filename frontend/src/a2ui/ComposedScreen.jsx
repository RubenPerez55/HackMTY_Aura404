import { useState } from "react";
import { resolveComponent } from "../components/componentRegistry.js";

/**
 * Orquesta una pantalla COMPUESTA (varios componentes reales, ver
 * reducer.js#resolveSurface): los monta en orden y conecta el mínimo de
 * estado local que necesitan para sentirse "vivos" sin llamar al
 * backend en cada interacción (spec.md RF-03):
 *  - solution_matrix_selector: qué opción está resaltada.
 *  - dynamic_value_slider: valor actual (para armar el resumen final).
 *  - security_action_gate: es el único que sí llama al backend --
 *    su `onConfirm(token)` arma un resumen con el contexto de arriba y
 *    lo manda hacia `onConfirm` (prop de App.jsx), que continúa la
 *    conversación con el agente (turno N+1).
 */
export default function ComposedScreen({ children, onConfirm }) {
  const solutionChild = children.find((c) => c.component === "solution_matrix_selector");
  const sliderChild = children.find((c) => c.component === "dynamic_value_slider");
  const securityChild = children.find((c) => c.component === "security_action_gate");

  const [selectedId, setSelectedId] = useState(solutionChild?.data?.selectedId);
  const [sliderValue, setSliderValue] = useState(sliderChild?.data?.value);

  const handleSecurityConfirm = async (token) => {
    const selectedOption = solutionChild?.data?.options?.find((o) => o.id === selectedId);
    const parts = [];
    if (securityChild?.data?.summaryBadge) parts.push(securityChild.data.summaryBadge);
    if (selectedOption) parts.push(`Opción elegida: ${selectedOption.title}.`);
    if (sliderChild && sliderValue != null) {
      parts.push(`${sliderChild.data.unitLabel}: ${sliderValue}.`);
    }
    const actionSummary = parts.join(" ") || "Confirmo la operación sugerida.";
    await onConfirm?.({ actionSummary, code: token });
  };

  return (
    <div className="space-y-4">
      {children.map((child) => {
        if (child.data === undefined) return null; // updateDataModel de ese id no ha llegado (todavía)
        const Component = resolveComponent(child.component);

        if (child.component === "solution_matrix_selector") {
          return (
            <Component
              key={child.id}
              data={child.data}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          );
        }
        if (child.component === "dynamic_value_slider") {
          return <Component key={child.id} data={child.data} onChange={setSliderValue} />;
        }
        if (child.component === "security_action_gate") {
          return <Component key={child.id} data={child.data} onConfirm={handleSecurityConfirm} />;
        }
        return <Component key={child.id} data={child.data} />;
      })}
    </div>
  );
}
