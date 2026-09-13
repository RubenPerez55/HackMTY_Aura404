import { useState, useMemo } from "react";
import { resolveComponent } from "../components/componentRegistry.js";

/**
 * Orquesta una pantalla COMPUESTA (varios componentes reales, ver
 * reducer.js#resolveSurface): los monta en orden y conecta el mínimo de
 * estado local que necesitan para sentirse "vivos" sin llamar al
 * backend en cada interacción (spec.md RF-03):
 *  - solution_matrix_selector: qué opción está seleccionada.
 *  - dynamic_value_slider: se activa y sincroniza de forma aislada para
 *    la opción correspondiente (meses para diferimiento vs puntos para canje),
 *    evitando contaminación de valores y desplegando en vivo los cálculos.
 *  - interactive_toggle_list: conmutación de servicios a domiciliar.
 *    Se deshabilita cuando el usuario elige una opción distinta a domiciliación.
 *  - security_action_gate: adapta su botón y badge al producto/estrategia
 *    financiera seleccionada en tiempo real.
 */
export default function ComposedScreen({ userName, title, children, onConfirm }) {
  const solutionChild = children.find((c) => c.component === "solution_matrix_selector");
  const securityChild = children.find((c) => c.component === "security_action_gate");
  const toggleChild = children.find((c) => c.component === "interactive_toggle_list");
  const metricChild = children.find((c) => c.component === "metric_delta_header");
  const sliderChildren = children.filter((c) => c.component === "dynamic_value_slider");

  const initialSelectedId =
    solutionChild?.data?.selectedId || solutionChild?.data?.options?.[0]?.id;
  const [selectedId, setSelectedId] = useState(initialSelectedId);
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
      actionSummary: [
        payload?.actionSummary,
        Object.keys(inputValues).length > 0
          ? `Datos capturados: ${JSON.stringify(inputValues)}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  };

  const firstName = userName?.trim().split(/\s+/)[0];
  const selectedOption =
    solutionChild?.data?.options?.find((o) => o.id === selectedId) ||
    solutionChild?.data?.options?.[0];

  const isPointsOption = (o) => {
    if (!o) return false;
    const id = (o.id || "").toLowerCase();
    const title = (o.title || "").toLowerCase();
    return id.includes("point") || id.includes("punto") || title.includes("punto");
  };

  const isInstallmentsOption = (o) => {
    if (!o) return false;
    const id = (o.id || "").toLowerCase();
    const title = (o.title || "").toLowerCase();
    return (
      id.includes("install") ||
      id.includes("mes") ||
      id.includes("plazo") ||
      id.includes("diferir") ||
      title.includes("diferir") ||
      title.includes("mes") ||
      title.includes("plazo") ||
      title.includes("msi")
    );
  };

  const isDomiciliationOption = (o) => {
    if (!o) return false;
    const id = (o.id || "").toLowerCase();
    const title = (o.title || "").toLowerCase();
    return id.includes("domicil") || title.includes("domicili");
  };

  const isAdvanceOption = (o) => {
    if (!o) return false;
    const id = (o.id || "").toLowerCase();
    const title = (o.title || "").toLowerCase();
    return id.includes("advance") || id.includes("nomina") || title.includes("adelanto");
  };

  const pointsOption = solutionChild?.data?.options?.find(isPointsOption);
  const installmentsOption = solutionChild?.data?.options?.find(isInstallmentsOption);
  const domiciliationOption = solutionChild?.data?.options?.find(isDomiciliationOption);
  const advanceOption = solutionChild?.data?.options?.find(isAdvanceOption);

  const isPointsSelected = Boolean(selectedOption && isPointsOption(selectedOption));
  const isInstallmentsSelected = Boolean(selectedOption && isInstallmentsOption(selectedOption));
  const isDomiciliationSelected = Boolean(
    !solutionChild || (selectedOption && isDomiciliationOption(selectedOption))
  );
  const isAdvanceSelected = Boolean(selectedOption && isAdvanceOption(selectedOption));

  // Encontrar sliders existentes en children si los hubo
  const existingPointsSlider = sliderChildren.find(
    (c) =>
      /punto|pts/i.test(c.data?.unitLabel || "") ||
      /point|punto/i.test(c.data?.appliesToOptionId || "")
  );

  const existingMonthsSlider = sliderChildren.find(
    (c) =>
      /mes|plazo/i.test(c.data?.unitLabel || "") ||
      /install|mes|plazo|diferir/i.test(c.data?.appliesToOptionId || "") ||
      (!/punto|pts/i.test(c.data?.unitLabel || "") && (c.data?.max ?? 0) <= 24)
  );

  const detectedBasis =
    existingMonthsSlider?.data?.basis ||
    existingPointsSlider?.data?.basis ||
    (typeof metricChild?.data?.currentValue === "number" ? metricChild.data.currentValue : 1500);

  // Estados locales separados para meses y puntos: nunca se contaminan
  const [monthsValue, setMonthsValue] = useState(
    () => existingMonthsSlider?.data?.value ?? 3
  );
  const [pointsValue, setPointsValue] = useState(
    () => existingPointsSlider?.data?.value ?? 4350
  );

  // Slider de puntos banorte
  const activePointsSlider = useMemo(() => {
    if (existingPointsSlider) {
      return {
        ...existingPointsSlider,
        data: {
          ...existingPointsSlider.data,
          value: pointsValue,
        },
      };
    }
    if (pointsOption) {
      const pts = pointsValue ?? 4350;
      const bonificacion = Math.round(pts / 10);
      const restante = Math.max(0, detectedBasis - bonificacion);
      return {
        id: "dynamic_slider_points_auto",
        component: "dynamic_value_slider",
        data: {
          min: 500,
          max: 4350,
          step: 250,
          value: pts,
          unitLabel: "Puntos Banorte a canjear",
          basis: detectedBasis,
          calculations: [
            { label: "Bonificación aplicada", value: bonificacion, format: "currency" },
            { label: "Restante a liquidar", value: restante, format: "currency" },
          ],
          appliesToOptionId: pointsOption.id,
        },
      };
    }
    return null;
  }, [existingPointsSlider, pointsOption, pointsValue, detectedBasis]);

  // Slider de diferimiento a meses
  const activeMonthsSlider = useMemo(() => {
    if (existingMonthsSlider) {
      return {
        ...existingMonthsSlider,
        data: {
          ...existingMonthsSlider.data,
          value: monthsValue,
        },
      };
    }
    if (installmentsOption) {
      const months = monthsValue || 3;
      const cuota = Math.round(detectedBasis / months);
      return {
        id: "dynamic_slider_months_auto",
        component: "dynamic_value_slider",
        data: {
          min: 3,
          max: 12,
          step: 3,
          value: months,
          unitLabel: "Meses de plazo",
          basis: detectedBasis,
          calculations: [
            { label: "Cuota mensual fija", value: cuota, format: "currency" },
            { label: "Tasa de interés", value: 0, format: "percent" },
          ],
          appliesToOptionId: installmentsOption.id,
        },
      };
    }
    return null;
  }, [existingMonthsSlider, installmentsOption, monthsValue, detectedBasis]);

  // Selección del slider activo según la opción seleccionada por el usuario
  const currentActiveSlider = useMemo(() => {
    if (isPointsSelected) return activePointsSlider;
    if (isInstallmentsSelected) return activeMonthsSlider;
    if (!solutionChild && sliderChildren.length > 0) return sliderChildren[0];
    return null;
  }, [
    isPointsSelected,
    isInstallmentsSelected,
    activePointsSlider,
    activeMonthsSlider,
    solutionChild,
    sliderChildren,
  ]);

  const toggleInactiveLabel = (() => {
    if (isDomiciliationSelected) return null;
    const target = domiciliationOption || solutionChild?.data?.options?.find(isDomiciliationOption);
    return `Selecciona "${target?.title ?? "Domiciliación de servicios"}" para activar la conmutación y exentar la anualidad.`;
  })();

  // Adaptación dinámica de SecurityActionGate a la estrategia elegida por el usuario
  const effectiveSecurityData = useMemo(() => {
    if (!securityChild?.data) return { actionLabel: "Autorizar Operación", summaryBadge: "" };
    const base = { ...securityChild.data };

    if (!selectedOption) return base;

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
    if (isPointsSelected) {
      const pts = pointsValue ?? 4350;
      const bonificacion = Math.round(Number(pts) / 10);
      return {
        ...base,
        actionLabel: "Autorizar Canje de Puntos",
        summaryBadge: `Canjear ${Number(pts).toLocaleString()} Puntos Banorte ($${bonificacion.toLocaleString()} MXN bonificados)`,
      };
    }

    // 3. Si está seleccionado Diferimiento a Meses (MSI)
    if (isInstallmentsSelected) {
      const months = monthsValue ?? 3;
      return {
        ...base,
        actionLabel: `Autorizar Diferimiento a ${months} Meses`,
        summaryBadge: `Diferir compra a ${months} Meses Sin Intereses`,
      };
    }

    // 4. Si está seleccionado Adelanto de Nómina
    if (isAdvanceSelected) {
      return {
        ...base,
        actionLabel: "Autorizar Adelanto de Nómina",
        summaryBadge: "Depósito inmediato de adelanto de nómina preaprobado",
      };
    }

    // 5. Cualquier otra opción seleccionada (ej. Pago con débito)
    return {
      ...base,
      actionLabel: `Autorizar ${selectedOption.title}`,
      summaryBadge: selectedOption.subtitle || selectedOption.title,
    };
  }, [
    securityChild?.data,
    selectedOption,
    isDomiciliationSelected,
    isPointsSelected,
    isInstallmentsSelected,
    isAdvanceSelected,
    selectedServices,
    pointsValue,
    monthsValue,
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
      const pts = pointsValue ?? 4350;
      parts.push(`Puntos a canjear: ${pts}.`);
    } else if (isInstallmentsSelected) {
      const months = monthsValue ?? 3;
      parts.push(`Plazo seleccionado: ${months} meses.`);
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
        ? {
            puntos_canjear: pointsValue ?? 4350,
            puntos: pointsValue ?? 4350,
            points_to_redeem: pointsValue ?? 4350,
          }
        : {}),
      ...(isInstallmentsSelected
        ? {
            meses_plazo: monthsValue ?? 3,
            valor_slider: monthsValue ?? 3,
            months: monthsValue ?? 3,
          }
        : {}),
    };
    const actionSummary = parts.join(" ") || "Confirmo la operación sugerida.";
    await onConfirm?.({ actionSummary, code: token, values: combinedValues });
  };

  // Montar lista de componentes insertando únicamente el slider activo para la opción elegida
  const displayChildren = useMemo(() => {
    if (!solutionChild) {
      return children;
    }

    const filtered = children.filter((c) => c.component !== "dynamic_value_slider");
    if (!currentActiveSlider) {
      return filtered;
    }

    const result = [];
    let inserted = false;
    for (const child of filtered) {
      if (!inserted && child.component === "security_action_gate") {
        result.push(currentActiveSlider);
        inserted = true;
      }
      result.push(child);
    }
    if (!inserted) {
      result.push(currentActiveSlider);
    }
    return result;
  }, [children, solutionChild, currentActiveSlider]);

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
          const isPoints = /punto|pts/i.test(child.data?.unitLabel || "");
          return (
            <Component
              key={child.id || (isPoints ? "slider-points" : "slider-months")}
              data={child.data}
              onChange={isPoints ? setPointsValue : setMonthsValue}
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
        if (child.component === "survey_form") {
          return <Component key={child.id} data={child.data} onSubmit={handleAction} />;
        }
        if (
          [
            "recommendation_card",
            "action_button_group",
            "empty_state",
            "error_state",
            "approval_flow",
            "insight_card",
          ].includes(child.component)
        ) {
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
