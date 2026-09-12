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
import LineGraph from "./LineGraph.jsx";
import GenericJsonView from "./GenericJsonView.jsx";
import BalanceCard from "./BalanceCard.jsx";
import TransactionList from "./TransactionList.jsx";
import TransactionDetail from "./TransactionDetail.jsx";
import SpendingChart from "./SpendingChart.jsx";
import ProgressBar from "./ProgressBar.jsx";
import RecommendationCard from "./RecommendationCard.jsx";
import ActionButtonGroup from "./ActionButtonGroup.jsx";
import FormField from "./FormField.jsx";
import DateRangePicker from "./DateRangePicker.jsx";
import DataTable from "./DataTable.jsx";
import StatusBadge from "./StatusBadge.jsx";
import Timeline from "./Timeline.jsx";
import ComparisonCard from "./ComparisonCard.jsx";
import DocumentPreview from "./DocumentPreview.jsx";
import EmptyState from "./EmptyState.jsx";
import LoadingState from "./LoadingState.jsx";
import ErrorState from "./ErrorState.jsx";
import ApprovalFlow from "./ApprovalFlow.jsx";

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
  line_graph: LineGraph,
  line_chart: LineGraph,
  solution_matrix_selector: SolutionMatrixSelector,
  dynamic_value_slider: DynamicValueSlider,
  interactive_toggle_list: InteractiveToggleList,
  security_action_gate: SecurityActionGate,
  balance_card: BalanceCard,
  transaction_list: TransactionList,
  transaction_detail: TransactionDetail,
  spending_chart: SpendingChart,
  progress_bar: ProgressBar,
  recommendation_card: RecommendationCard,
  action_button_group: ActionButtonGroup,
  form_field: FormField,
  date_range_picker: DateRangePicker,
  data_table: DataTable,
  status_badge: StatusBadge,
  timeline: Timeline,
  comparison_card: ComparisonCard,
  document_preview: DocumentPreview,
  empty_state: EmptyState,
  loading_state: LoadingState,
  error_state: ErrorState,
  approval_flow: ApprovalFlow,
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
