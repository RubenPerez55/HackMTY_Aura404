// Datos sintéticos para la demo. Estos payloads simulan lo que, en la
// arquitectura real (ver docs/03-arquitectura-tecnica/01-arquitectura-referencia.md),
// vendría como "trigger financiero estructurado" del Motor de detección
// + la respuesta A2UI ya compuesta por el Agente financiero.
// Cada objeto de aquí corresponde 1:1 a las props que espera su
// componente en docs/03-arquitectura-tecnica/02-catalogo-componentes.md.

export const user = {
  name: "Carlos Mendoza",
  accountLabel: "Cuenta Enlace Digital",
  accountMask: "•••• 4821",
  balance: 34850.5,
};

// RF-01.1 — Service Spike (ej. recibo de CFE muy por arriba del promedio)
export const serviceSpikeData = {
  service: "CFE (Luz)",
  currentAmount: 3120,
  historicalAverage: 1830,
  overageAmount: 1290,
  pointsAvailable: 980,
  pointsToMxnRate: 1.5, // 1 punto = $1.50 MXN
};

// RF-01.2 — Annual Fee (anualidad de tarjeta por vencer)
export const annualFeeData = {
  feeAmount: 850,
  dueDate: "2026-09-21",
  eligibleServices: [
    { id: "netflix", label: "Netflix", monthlyAmount: 219 },
    { id: "spotify", label: "Spotify Premium", monthlyAmount: 129 },
    { id: "telcel", label: "Plan Telcel", monthlyAmount: 399 },
  ],
};

// RF-01.3 — Liquidity Shock (compra que consume la mayoría del saldo)
export const liquidityShockData = {
  transactionAmount: 8200,
  currentBalance: 9400,
  daysUntilPayroll: 6,
  planOptions: [
    { months: 3, monthlyPayment: 2843, note: "Sin intereses" },
    { months: 6, monthlyPayment: 1478, note: "CAT 22%" },
    { months: 12, monthlyPayment: 782, note: "CAT 28%" },
  ],
};

// Triggers pendientes que alimentan el AlertBanner del dashboard.
// En la app real, esto lo produce el Motor de detección de impacto
// financiero (ver arquitectura) — aquí se simula estático.
export const pendingTriggers = [
  {
    id: "trigger_service_spike",
    type: "SERVICE_SPIKE_DETECTED",
    uiHint: "service_spike_card",
    severity: "high",
    title: "Tu recibo de CFE llegó 70% más alto",
    subtitle: "Detectamos un sobrecosto de $1,290 vs. tu promedio habitual",
    data: serviceSpikeData,
  },
  {
    id: "trigger_annual_fee",
    type: "ANNUAL_FEE_UPCOMING",
    uiHint: "annual_fee_card",
    severity: "medium",
    title: "Tu anualidad se cobra en 5 días",
    subtitle: "Puedes exentarla domiciliando un servicio",
    data: annualFeeData,
  },
  {
    id: "trigger_liquidity_shock",
    type: "LIQUIDITY_SHOCK_DETECTED",
    uiHint: "liquidity_shock_card",
    severity: "high",
    title: "Este cargo dejó tu saldo muy bajo",
    subtitle: "Faltan 6 días para tu próxima nómina",
    data: liquidityShockData,
  },
];
