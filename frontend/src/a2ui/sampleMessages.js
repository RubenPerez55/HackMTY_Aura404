// Mensajes A2UI de ejemplo -- validados contra
// `mcp-agent/src/agent/a2ui-contract.ts` (el LLM compone este JSON
// directamente como su respuesta final; ver docs/03-arquitectura-tecnica/
// 04-a2ui-generado-por-el-agente.md). Útiles para:
//   1. Probar el runtime (reducer.js / useA2uiRuntime.js) sin necesitar
//      todavía el backend completo corriendo con LLM real.
//   2. Servir de contrato de referencia entre frontend y backend: si el
//      server cambia la forma del JSON, este archivo debe actualizarse.
export const SAMPLE_SERVICE_SPIKE_MESSAGES = [
  {
    type: "createSurface",
    surfaceId: "srv_demo_1",
    root: { id: "root", component: "service_spike_card" },
  },
  {
    type: "updateComponents",
    surfaceId: "srv_demo_1",
    components: [
      { id: "root", component: "service_spike_card", catalogId: "banorte-shockabsorber" },
    ],
  },
  {
    type: "updateDataModel",
    surfaceId: "srv_demo_1",
    path: "/",
    value: {
      service: "CFE (Luz)",
      currentAmount: 3120,
      historicalAverage: 1830,
      overageAmount: 1290,
      pointsAvailable: 980,
      pointsToMxnRate: 1.5,
    },
  },
];

// Pantalla de referencia para el catálogo ampliado. Demuestra cómo una
// respuesta del agente combina resumen, movimientos, recomendación y acción.
export const SAMPLE_ACCOUNT_OVERVIEW_MESSAGES = [
  {
    type: "createSurface",
    surfaceId: "account_demo_1",
    root: { id: "root", component: "surface_root", children: ["balance", "transactions", "recommendation", "actions"] },
  },
  {
    type: "updateComponents",
    surfaceId: "account_demo_1",
    components: [
      { id: "root", component: "surface_root", catalogId: "banorte-shockabsorber", children: ["balance", "transactions", "recommendation", "actions"] },
      { id: "balance", component: "balance_card" },
      { id: "transactions", component: "transaction_list" },
      { id: "recommendation", component: "recommendation_card" },
      { id: "actions", component: "action_button_group" },
    ],
  },
  { type: "updateDataModel", surfaceId: "account_demo_1", path: "/balance", value: { title: "Cuenta Enlace", availableBalance: 18450, currency: "MXN", currentDebt: 2300 } },
  { type: "updateDataModel", surfaceId: "account_demo_1", path: "/transactions", value: { title: "Últimos movimientos", currency: "MXN", transactions: [{ id: "tx-1", description: "Nómina", amount: 12000, date: "2026-09-12", category: "Ingresos" }, { id: "tx-2", description: "Supermercado", amount: -860, date: "2026-09-11", category: "Alimentos" }] } },
  { type: "updateDataModel", surfaceId: "account_demo_1", path: "/recommendation", value: { title: "Aparta una parte de tu nómina", description: "Puedes avanzar tu meta sin comprometer tus pagos próximos.", badge: "Personalizado", benefit: "Ahorro sugerido: $1,200" } },
  { type: "updateDataModel", surfaceId: "account_demo_1", path: "/actions", value: { title: "¿Qué quieres hacer?", actions: [{ id: "create_savings_goal", label: "Crear meta de ahorro", variant: "primary" }, { id: "view_analysis", label: "Ver análisis", variant: "secondary" }] } },
];
