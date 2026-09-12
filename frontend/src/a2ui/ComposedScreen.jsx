import { useState, useMemo } from "react";
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
 *    en vez de quedarse ahí sin reaccionar.
 *  - interactive_toggle_list: conmutación de servicios a domiciliar.
 *    Se deshabilita cuando el usuario elige una opción distinta a domiciliación.
 *  - security_action_gate: adapta su botón y badge al producto/estrategia
 *    financiera seleccionada en tiempo real.
 */
export default function ComposedScreen({ userName, title, children, onConfirm }) {
  const solutionChild = children.find((c) => c.component === "solution_matrix_selector");
  const sliderChild = children.find((c) => c.component === "dynamic_value_slider");
  const securityChild = children.find((c) => c.component === "security_action_gate");
  const toggleChild = children.find((c) => c.component === "interactive_toggle_list");

  const [selectedId, setSelectedId] = useState(solutionChild?.data?.selectedId);
  const [selectedServices, setSelectedServices] = useState(() => {
    return toggleChild?.data?.items?.filter((i) => i.isSelected) || [];
  });
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
  const selectedOption = solutionChild?.data?.options?.find((o) => o.id === selectedId);

  // Detección de tipos de opción
  const isDomiciliationSelected =
    !solutionChild ||
    Boolean(
      selectedId?.toLowerCase().includes("domicil") ||
      selectedOption?.title?.toLowerCase().includes("domicili")
    );

  const pointsOption = solutionChild?.data?.options?.find(
    (o) =>
      (o.id || "").toLowerCase().includes("point") ||
      (o.id || "").toLowerCase().includes("punto") ||
      (o.title || "").toLowerCase().includes("punto")
  );

  const isPointsSelected = Boolean(
    selectedId?.toLowerCase().includes("point") ||
    selectedId?.toLowerCase().includes("punto") ||
    selectedOption?.title?.toLowerCase().includes("punto")
  );

  // Si el LLM ofreció la opción de puntos en el selector pero omitió el dynamic_value_slider en A2UI,
  // se sintetiza un slider calibrado con los puntos disponibles (4,350 pts = $435 MXN)
  const effectiveSliderChild = useMemo(() => {
    if (sliderChild) return sliderChild;
    if (pointsOption) {
      return {
        id: "dynamic_slider_points_auto",
        component: "dynamic_value_slider",
        data: {
          min: 500,
          max: 4350,
          step: 250,
          value: 4350,
          unitLabel: "Puntos Banorte a canjear",
          basis: 1500,
          calculations: [
            { label: "Bonificación aplicada", value: 435, format: "currency" },
            { label: "Restante de anualidad", value: 1065, format: "currency" },
          ],
          appliesToOptionId: pointsOption.id,
        },
      };
    }
    return null;
  }, [sliderChild, pointsOption]);

  const [sliderValue, setSliderValue] = useState(
    () => sliderChild?.data?.value ?? effectiveSliderChild?.data?.value
  );

  const sliderAppliesToOptionId = effectiveSliderChild?.data?.appliesToOptionId;
  const sliderIsActive = !sliderAppliesToOptionId || sliderAppliesToOptionId === selectedId;
  const sliderInactiveLabel = (() => {
    if (sliderIsActive) return null;
    const target = solutionChild?.data?.options?.find((o) => o.id === sliderAppliesToOptionId);
    return `Selecciona "${target?.title ?? "Canjear Puntos Banorte"}" para calibrar este monto.`;
  })();

  const toggleInactiveLabel = (() => {
    if (isDomiciliationSelected) return null;
    const target = solutionChild?.data?.options?.find((o) =>
      (o.id || "").toLowerCase().includes("domicil") || (o.title || "").toLowerCase().includes("domicili")
    );
    return `Selecciona "${target?.title ?? "Domiciliación de servicios"}" para activar la conmutación y exentar la anualidad.`;
  })();

  // Adaptación dinámica de SecurityActionGate a la estrategia elegida por el usuario
  const effectiveSecurityData = useMemo(() => {
    if (!securityChild?.data) return { actionLabel: "Autorizar Operación", summaryBadge: "" };
    const base = { ...securityChild.data };

    if (!selectedOption) return base;

    const optId = (selectedOption.id || "").toLowerCase();
    const optTitle = (selectedOption.title || "").toLowerCase();

    // 1. Si está seleccionada Domiciliación
    if (isDomiciliationSelected) {
      const count = selectedServices?.length || 0;
      return {
        ...base,
        actionLabel: "Autorizar Exención y Domiciliación",
        summaryBadge:
          count > 0
            ? `Exención 100% de Anualidad · Domiciliando ${count} servicio(s)`
            : "Exentar Anualidad domiciliando servicios",
      };
    }

    // 2. Si está seleccionado Canje de Puntos
    if (optId.includes("point") || optId.includes("punto") || optTitle.includes("punto")) {
      const pts = sliderValue ?? effectiveSliderChild?.data?.value ?? 4350;
      const bonificacion = Math.round(Number(pts) / 10);
      return {
        ...base,
        actionLabel: "Autorizar Canje de Puntos",
        summaryBadge: `Canjear ${Number(pts).toLocaleString()} Puntos Banorte ($${bonificacion.toLocaleString()} MXN bonificados)`,
      };
    }

    // 3. Si está seleccionado Diferimiento a Meses (MSI)
    if (
      optId.includes("install") ||
      optId.includes("mes") ||
      optId.includes("plazo") ||
      optTitle.includes("diferir")
    ) {
      const months = sliderValue ?? 3;
      return {
        ...base,
        actionLabel: `Autorizar Diferimiento a ${months} Meses`,
        summaryBadge: `Diferir compra a ${months} Meses Sin Intereses`,
      };
    }

    // 4. Si está seleccionado Adelanto de Nómina
    if (optId.includes("advance") || optId.includes("nomina") || optTitle.includes("adelanto")) {
      return {
        ...base,
        actionLabel: "Autorizar Adelanto de Nómina",
        summaryBadge: "Depósito inmediato de adelanto de nómina preaprobado",
      };
    }

    // 5. Cualquier otra opción seleccionada
    return {
      ...base,
      actionLabel: `Autorizar ${selectedOption.title}`,
      summaryBadge: selectedOption.subtitle || selectedOption.title,
    };
  }, [
    securityChild?.data,
    selectedOption,
    isDomiciliationSelected,
    selectedServices,
    sliderValue,
    effectiveSliderChild,
  ]);

  const handleSecurityConfirm = async (token) => {
    const parts = [];
    if (effectiveSecurityData.summaryBadge) {
      parts.push(effectiveSecurityData.summaryBadge + ".");
    }
    if (selectedOption) {
      parts.push(`Opción elegida: ${selectedOption.title}.`);
    }
    if (isPointsSelected) {
      const pts = sliderValue ?? effectiveSliderChild?.data?.value ?? 4350;
      parts.push(`Puntos a canjear: ${pts}.`);
    } else if (effectiveSliderChild && sliderIsActive && sliderValue != null) {
      parts.push(`${effectiveSliderChild.data.unitLabel}: ${sliderValue}.`);
    }
    if (isDomiciliationSelected && selectedServices && selectedServices.length > 0) {
      const names = selectedServices.map((s) => s.name || s.id);
      parts.push(`Servicios confirmados para domiciliar: ${names.join(", ")}.`);
    }
    const combinedValues = {
      ...inputValues,
      opcion_id: selectedOption?.id,
      opcion_titulo: selectedOption?.title,
      ...(isDomiciliationSelected && selectedServices.length > 0
        ? { servicios_domiciliar: selectedServices.map((s) => s.name || s.id) }
        : {}),
      ...(isPointsSelected
        ? { puntos_canjear: sliderValue ?? effectiveSliderChild?.data?.value ?? 4350 }
        : {}),
      ...(effectiveSliderChild && sliderIsActive && sliderValue != null
        ? { valor_slider: sliderValue }
        : {}),
    };
    const actionSummary = parts.join(" ") || "Confirmo la operación sugerida.";
    await onConfirm?.({ actionSummary, code: token, values: combinedValues });
  };

  // Lista de componentes a desplegar (insertando el slider si fue sintetizado)
  const displayChildren = useMemo(() => {
    if (sliderChild || !effectiveSliderChild) return children;
    const newChildren = [];
    let inserted = false;
    for (const child of children) {
      newChildren.push(child);
      if (
        !inserted &&
        (child.component === "interactive_toggle_list" ||
          (!children.some((c) => c.component === "interactive_toggle_list") &&
            child.component === "solution_matrix_selector"))
      ) {
        newChildren.push(effectiveSliderChild);
        inserted = true;
      }
    }
    if (!inserted) {
      const gateIdx = newChildren.findIndex((c) => c.component === "security_action_gate");
      if (gateIdx !== -1) {
        newChildren.splice(gateIdx, 0, effectiveSliderChild);
      } else {
        newChildren.push(effectiveSliderChild);
      }
    }
    return newChildren;
  }, [children, sliderChild, effectiveSliderChild]);

  return (
    <div className="space-y-4">
      {firstName && (
        <h2 className="text-lg font-bold text-gray-900 leading-snug">Resumen de {firstName}</h2>
      )}
      {title && <p className="text-sm text-gray-500 -mt-3">{title}</p>}
      {displayChildren.map((child) => {
        if (child.data === undefined) return null;
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
        if (child.component === "interactive_toggle_list") {
          return (
            <Component
              key={child.id}
              data={child.data}
              onChange={setSelectedServices}
              inactiveLabel={toggleInactiveLabel}
              disabled={!isDomiciliationSelected}
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
          return (
            <Component
              key={child.id}
              data={effectiveSecurityData}
              onConfirm={handleSecurityConfirm}
            />
          );
        }
        if (["form_field", "date_range_picker", "comparison_card"].includes(child.component)) {
          return <Component key={child.id} data={child.data} onValueChange={handleValueChange} />;
        }
        if (["recommendation_card", "action_button_group", "empty_state", "error_state", "approval_flow"].includes(child.component)) {
          return <Component key={child.id} data={child.data} onAction={handleAction} />;
        }
        return <Component key={child.id} data={child.data} />;
      })}

      <p className="text-center text-[10px] text-gray-300 pt-1">
        Componente generado tras análisis de LLM
      </p>
    </div>
  );
}
