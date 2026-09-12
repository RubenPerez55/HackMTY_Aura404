import { useState } from "react";
import { resolveComponent } from "../components/componentRegistry.js";

/**
 * Orquesta una pantalla COMPUESTA (varios componentes reales, ver
 * reducer.js#resolveSurface): los monta en orden y conecta el mínimo de
 * estado local que necesitan para sentirse "vivos" sin llamar al
 * backend en cada interacción (spec.md RF-03):
 *  - solution_matrix_selector: qué opción está resaltada.
 *  - dynamic_value_slider: valor actual (para armar el resumen final).
 *    Si trae `appliesToOptionId`, solo se muestra "vivo" cuando esa es
 *    la opción seleccionada -- si el usuario elige otra, se deshabilita
 *    en vez de quedarse ahí sin reaccionar (eso era el bug: parecía
 *    ligado a "Canjear puntos" pero no se enteraba de qué opción estaba
 *    activa).
 *  - security_action_gate: es el único que sí llama al backend --
 *    su `onConfirm(token)` arma un resumen con el contexto de arriba y
 *    lo manda hacia `onConfirm` (prop de App.jsx), que continúa la
 *    conversación con el agente (turno N+1).
 *
 * `userName` es el saludo fijo de la pantalla ("Resumen de <nombre>") --
 * lo arma el FRONTEND, no el LLM: así siempre aparece, sin depender de
 * que el modelo se acuerde de mandarlo. El `title` que sí manda el LLM
 * (opcional) es la línea situacional de abajo (p. ej. "Sobrecosto
 * detectado en tu recibo de CFE").
 */
export default function ComposedScreen({ userName, title, children, onConfirm }) {
  const solutionChild = children.find((c) => c.component === "solution_matrix_selector");
  const sliderChild = children.find((c) => c.component === "dynamic_value_slider");
  const securityChild = children.find((c) => c.component === "security_action_gate");

  const [selectedId, setSelectedId] = useState(solutionChild?.data?.selectedId);
  const [sliderValue, setSliderValue] = useState(sliderChild?.data?.value);
  const [inputValues, setInputValues] = useState({});

  const handleValueChange = (name, value) => {
    setInputValues((previous) => ({ ...previous, [name]: value }));
  };

  const handleAction = async (payload) => {
    await onConfirm?.({
      ...payload,
      values: inputValues,
      actionSummary: [payload?.actionSummary, Object.keys(inputValues).length > 0
        ? `Datos capturados: ${JSON.stringify(inputValues)}.`
        : ""].filter(Boolean).join(" "),
    });
  };

  const firstName = userName?.trim().split(/\s+/)[0];
  const sliderAppliesToOptionId = sliderChild?.data?.appliesToOptionId;
  const sliderIsActive = !sliderAppliesToOptionId || sliderAppliesToOptionId === selectedId;
  const sliderInactiveLabel = (() => {
    if (sliderIsActive) return null;
    const target = solutionChild?.data?.options?.find((o) => o.id === sliderAppliesToOptionId);
    return `Selecciona "${target?.title ?? "la opción correspondiente"}" para ajustar este monto.`;
  })();

  const handleSecurityConfirm = async (token) => {
    const selectedOption = solutionChild?.data?.options?.find((o) => o.id === selectedId);
    const parts = [];
    if (securityChild?.data?.summaryBadge) parts.push(securityChild.data.summaryBadge);
    if (selectedOption) parts.push(`Opción elegida: ${selectedOption.title}.`);
    if (sliderChild && sliderIsActive && sliderValue != null) {
      parts.push(`${sliderChild.data.unitLabel}: ${sliderValue}.`);
    }
    const actionSummary = parts.join(" ") || "Confirmo la operación sugerida.";
    await onConfirm?.({ actionSummary, code: token, values: inputValues });
  };

  return (
    <div className="space-y-4">
      {firstName && (
        <h2 className="text-lg font-bold text-gray-900 leading-snug">Resumen de {firstName}</h2>
      )}
      {title && <p className="text-sm text-gray-500 -mt-3">{title}</p>}
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
          return (
            <Component
              key={child.id}
              data={child.data}
              onChange={setSliderValue}
              inactiveLabel={sliderInactiveLabel}
            />
          );
        }
        if (child.component === "security_action_gate") {
          return <Component key={child.id} data={child.data} onConfirm={handleSecurityConfirm} />;
        }
        if (["form_field", "date_range_picker", "comparison_card"].includes(child.component)) {
          return <Component key={child.id} data={child.data} onValueChange={handleValueChange} />;
        }
        if (["recommendation_card", "action_button_group", "empty_state", "error_state", "approval_flow"].includes(child.component)) {
          return <Component key={child.id} data={child.data} onAction={handleAction} />;
        }
        return <Component key={child.id} data={child.data} />;
      })}

      {/* Leyenda: deja claro que esta pantalla no es un mock -- el LLM
          decidió estos componentes y sus datos a partir del análisis del
          estímulo + las tools MCP (ver task.md). */}
      <p className="text-center text-[10px] text-gray-300 pt-1">
        Componente generado tras análisis de LLM
      </p>
    </div>
  );
}
