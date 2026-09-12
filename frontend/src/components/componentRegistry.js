import ServiceSpikeCard from "./ServiceSpikeCard.jsx";
import AnnualFeeCard from "./AnnualFeeCard.jsx";
import LiquidityShockCard from "./LiquidityShockCard.jsx";
import GenericJsonView from "./GenericJsonView.jsx";

// Component registry: mapa uiHint -> componente. Ver docs/01-agentic-ui-
// frontend/03-arquitectura-componentes-reutilizables.md y docs/03-
// arquitectura-tecnica/02-catalogo-componentes.md.
// Cuando el backend/A2UI mande un uiHint nuevo, solo hay que agregar una
// línea aquí (y construir el componente) — nada más del app se toca.
export const componentRegistry = {
  service_spike_card: ServiceSpikeCard,
  annual_fee_card: AnnualFeeCard,
  liquidity_shock_card: LiquidityShockCard,
};

export function resolveComponent(uiHint) {
  return componentRegistry[uiHint] || GenericJsonView;
}
