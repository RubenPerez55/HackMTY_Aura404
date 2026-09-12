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
