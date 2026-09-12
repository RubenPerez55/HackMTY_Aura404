import ServiceSpikeCard from "./ServiceSpikeCard.jsx";
import AnnualFeeCard from "./AnnualFeeCard.jsx";
import LiquidityShockCard from "./LiquidityShockCard.jsx";
import TwoFactorModal from "./TwoFactorModal.jsx";
import ConfirmationReceipt from "./ConfirmationReceipt.jsx";
import MetricDeltaHeader from "./MetricDeltaHeader.jsx";
import TrendHistoryChart from "./TrendHistoryChart.jsx";
import SolutionMatrixSelector from "./SolutionMatrixSelector.jsx";
import DynamicValueSlider from "./DynamicValueSlider.jsx";
import InteractiveToggleList from "./InteractiveToggleList.jsx";
import SecurityActionGate from "./SecurityActionGate.jsx";
import GenericJsonView from "./GenericJsonView.jsx";

// Component registry: mapa nombre de componente A2UI -> componente
// React. Ver docs/01-agentic-ui-frontend/03-arquitectura-componentes-
// reutilizables.md y docs/03-arquitectura-tecnica/02-catalogo-
// componentes.md.
// Cuando el backend/A2UI mande un componente nuevo, solo hay que
// agregar una línea aquí (y construirlo) — nada más del app se toca.
//
// -- catálogo "compuesto" (piezas reutilizables, ver a2ui-contract.ts) --
// El LLM las combina libremente en una misma pantalla (ver
// ComposedScreen.jsx); no hay un flujo fijo de "primero esto, luego
// aquello" hardcodeado en el frontend.
//
// -- catálogo legacy (monolítico) -- se deja registrado por
// compatibilidad para cuando se diseñen los casos de anualidad/
// liquidez (todavía pendientes); no se le pide al LLM que los use hoy.
export const componentRegistry = {
  // compuesto
  metric_delta_header: MetricDeltaHeader,
  trend_history_chart: TrendHistoryChart,
  solution_matrix_selector: SolutionMatrixSelector,
  dynamic_value_slider: DynamicValueSlider,
  interactive_toggle_list: InteractiveToggleList,
  security_action_gate: SecurityActionGate,
  // pantalla final (siempre de un solo nodo)
  confirmation_receipt: ConfirmationReceipt,
  // legacy
  service_spike_card: ServiceSpikeCard,
  annual_fee_card: AnnualFeeCard,
  liquidity_shock_card: LiquidityShockCard,
  two_factor_modal: TwoFactorModal,
};

export function resolveComponent(uiHint) {
  return componentRegistry[uiHint] || GenericJsonView;
}
