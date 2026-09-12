/**
 * Contrato A2UI — decisión del equipo (paso 3, revisado): el JSON de
 * A2UI lo compone el propio LLM, usando los datos que ya obtuvo de las
 * tools MCP normales (`banking__*`, `impact__*`). Los servers MCP se
 * quedan puros: solo dan datos/acciones, nunca arman UI.
 *
 * Revisión (paso 4): la interfaz dejó de ser "una tarjeta monolítica
 * por escenario" -- ahora el LLM arma la PANTALLA pieza por pieza,
 * combinando varios componentes reutilizables (gráficas, selectores,
 * sliders, etc. -- ver docs/03-arquitectura-tecnica/02-catalogo-
 * componentes.md) en el orden que decida. Esto es más fiel al árbol de
 * componentes real de A2UI (adjacency list): una surface tiene un nodo
 * raíz `surface_root` (sin datos propios) cuyo `children` lista, en
 * orden, los ids de los componentes reales a mostrar.
 *
 * Compatibilidad: una surface también puede seguir siendo UN SOLO
 * componente en la raíz (sin `children`), como en el diseño original --
 * útil para escenarios que todavía no se han rediseñado a este modelo
 * (anualidad de tarjeta / liquidez, pendientes) y para `confirmation_
 * receipt`, que siempre se manda como pantalla propia de un solo nodo.
 *
 * Este módulo es el "contrato" del que se habló con el equipo: define
 * (a) qué componentes existen y qué datos espera cada uno, y (b) un
 * validador (`parseA2uiAnswer`) que el backend corre sobre la respuesta
 * final del LLM ANTES de mandarla al frontend — así, si el modelo
 * escribe un JSON mal formado, inventa un componente que no existe, o
 * le faltan campos a alguno, el backend lo detecta (y cae a una
 * respuesta de solo texto) en vez de mandarle basura al frontend.
 */
import { z } from "zod";

export const A2UI_CATALOG_ID = "banorte-shockabsorber";

/** Nombre reservado del nodo contenedor: agrupa componentes hijos, sin datos propios. */
export const ROOT_COMPONENT = "surface_root";

/**
 * Componentes "hoja" -- cada uno con su propio `value` validado. Ver
 * docs/03-arquitectura-tecnica/02-catalogo-componentes.md para el
 * detalle visual de cada uno.
 */
export const ComponentDataSchemas = {
  // --- catálogo "compuesto" (piezas reutilizables que el LLM combina) ---
  metric_delta_header: z.object({
    title: z.string(),
    currentValue: z.number(),
    baselineValue: z.number().optional(),
    deltaText: z.string().optional(),
    status: z.enum(["critical", "warning", "success"]),
  }),
  trend_history_chart: z.object({
    bars: z.array(
      z.object({
        label: z.string(),
        amount: z.number(),
        isAnomaly: z.boolean().optional(),
        isProjected: z.boolean().optional(),
      }),
    ),
    currency: z.string(),
  }),
  solution_matrix_selector: z.object({
    options: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        subtitle: z.string(),
        tag: z.string().optional(),
        recommended: z.boolean().optional(),
        // Opcional a propósito: el frontend (SolutionMatrixSelector.jsx)
        // ya cae a un ícono por default si el LLM lo omite o inventa uno
        // fuera del set conocido -- no vale la pena descartar TODA la
        // pantalla (metric headers, slider, security gate...) por un
        // campo puramente cosmético.
        iconName: z.string().optional(),
      }),
    ),
    selectedId: z.string(),
  }),
  dynamic_value_slider: z.object({
    min: z.number(),
    max: z.number(),
    step: z.number(),
    value: z.number(),
    unitLabel: z.string(),
    // Monto total a cubrir (p. ej. el sobrecosto detectado). Con esto el
    // FRONTEND recalcula `calculations` en vivo mientras arrastras el
    // slider, sin volver a llamar al agente (spec.md RF-03: instantáneo).
    basis: z.number(),
    calculations: z.array(
      z.object({
        label: z.string(),
        value: z.number(),
        format: z.enum(["currency", "number", "percent"]).optional(),
      }),
    ),
  }),
  interactive_toggle_list: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        amount: z.number(),
        currentPaymentMethod: z.string(),
        isSelected: z.boolean(),
      }),
    ),
  }),
  security_action_gate: z.object({
    actionLabel: z.string(),
    summaryBadge: z.string(),
  }),

  // --- catálogo "monolítico" original (legacy) ---
  // Todavía válido para escenarios no rediseñados (anualidad/liquidez,
  // pendientes -- ver docs/03-arquitectura-tecnica). No se le pide al
  // LLM que los use para el caso CFE; se dejan aquí por compatibilidad.
  service_spike_card: z.object({
    service: z.string(),
    currentAmount: z.number(),
    historicalAverage: z.number(),
    overageAmount: z.number(),
    pointsAvailable: z.number(),
    pointsToMxnRate: z.number(),
  }),
  annual_fee_card: z.object({
    feeAmount: z.number(),
    dueDate: z.string(),
    eligibleServices: z.array(
      z.object({ id: z.string(), label: z.string(), monthlyAmount: z.number() }),
    ),
  }),
  liquidity_shock_card: z.object({
    transactionAmount: z.number(),
    currentBalance: z.number(),
    daysUntilPayroll: z.number(),
    planOptions: z.array(
      z.object({ months: z.number(), monthlyPayment: z.number(), note: z.string() }),
    ),
  }),
  two_factor_modal: z.object({
    actionSummary: z.string(),
  }),

  // --- pantalla final, siempre de un solo nodo ---
  confirmation_receipt: z.object({
    folio: z.string(),
    newBalance: z.number().optional(),
    actionDescription: z.string(),
  }),
} as const;

export type ComponentName = keyof typeof ComponentDataSchemas;
export const COMPONENT_NAMES = Object.keys(ComponentDataSchemas) as ComponentName[];

/** El nombre de un componente en `root`/`components`: uno real, o el contenedor. */
const componentNameSchema = z.union([
  z.literal(ROOT_COMPONENT),
  z.enum(COMPONENT_NAMES as [ComponentName, ...ComponentName[]]),
]);

const componentRefSchema = z.object({
  id: z.string(),
  component: componentNameSchema,
  catalogId: z.string().optional(),
  // Solo lo lleva el nodo raíz cuando agrupa varios componentes reales,
  // en el orden en que deben mostrarse (de arriba hacia abajo).
  children: z.array(z.string()).optional(),
  // Solo lo lleva el nodo raíz de una pantalla COMPUESTA: título corto
  // que resume la pantalla completa, para que el frontend le dé
  // estructura visual en vez de mostrar los componentes sueltos.
  title: z.string().optional(),
});

/** Los 3 tipos de mensaje A2UI que de verdad usamos (ver paso 2). */
const a2uiMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("createSurface"),
    surfaceId: z.string(),
    root: componentRefSchema,
  }),
  z.object({
    type: z.literal("updateComponents"),
    surfaceId: z.string(),
    components: z.array(componentRefSchema),
  }),
  z.object({
    type: z.literal("updateDataModel"),
    surfaceId: z.string(),
    path: z.string(),
    value: z.unknown(),
  }),
]);

export const a2uiAnswerSchema = z.array(a2uiMessageSchema).min(1);

export type A2uiMessage = z.infer<typeof a2uiMessageSchema>;

export type ParsedA2uiAnswer =
  | { ok: true; messages: A2uiMessage[] }
  | { ok: false; reason: string };

/**
 * Intenta interpretar la respuesta final del LLM como A2UI.
 *
 * Se llama SIEMPRE sobre `finalAnswer` (el texto que el AgentLoop
 * regresa cuando el modelo ya no pide más tools). Si el modelo
 * respondió en lenguaje natural normal (la mayoría de los turnos), esto
 * falla "silenciosamente" (`ok: false`) y el turno se trata como texto
 * plano -- no es un error, es el camino esperado cuando no toca mostrar
 * ni actualizar UI todavía (p. ej. el usuario preguntó algo por chat).
 *
 * Además de validar la forma (JSON + schema), valida que cada
 * `updateDataModel` tenga los campos que SU componente espera --
 * resolviendo el dueño de cada `path`:
 *   - `path: "/"` -> el componente en la raíz de esa surface (modo
 *     "un solo componente", compatibilidad hacia atrás).
 *   - `path: "/<id>"` -> el componente hijo con ese id (modo
 *     "pantalla compuesta").
 * Así detectamos que el modelo "olvidó" un campo, o le puso datos al
 * componente equivocado, antes de que sea el frontend quien se entere
 * a medias.
 */
export function parseA2uiAnswer(text: string | null): ParsedA2uiAnswer {
  if (!text) return { ok: false, reason: "Respuesta vacía." };

  const trimmed = text.trim();
  // El LLM a veces envuelve el JSON en ```json ... ``` pese a instrucciones;
  // lo toleramos para no ser frágiles innecesariamente.
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();

  let raw: unknown;
  try {
    raw = JSON.parse(unfenced);
  } catch {
    return { ok: false, reason: "No es JSON válido (probablemente es una respuesta en texto normal)." };
  }

  const parsed = a2uiAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: `No cumple el contrato A2UI: ${parsed.error.message}` };
  }
  const messages = parsed.data;

  // id -> nombre de componente, con TODO lo declarado en el batch
  // (createSurface.root cuenta como una declaración más).
  const rootIdBySurface = new Map<string, string>();
  const componentNameById = new Map<string, string>();
  for (const message of messages) {
    if (message.type === "createSurface") {
      rootIdBySurface.set(message.surfaceId, message.root.id);
      componentNameById.set(message.root.id, message.root.component);
    }
    if (message.type === "updateComponents") {
      for (const c of message.components) componentNameById.set(c.id, c.component);
    }
  }

  for (const message of messages) {
    if (message.type !== "updateDataModel") continue;

    const targetId =
      message.path === "/" ? rootIdBySurface.get(message.surfaceId) : message.path.replace(/^\//, "");
    if (!targetId) continue; // no debería pasar si el orden de mensajes es correcto

    const componentName = componentNameById.get(targetId);
    // Sin dueño identificable, o es el contenedor (sin datos propios):
    // no hay nada que validar.
    if (!componentName || componentName === ROOT_COMPONENT) continue;

    const dataSchema = ComponentDataSchemas[componentName as ComponentName];
    if (!dataSchema) {
      return { ok: false, reason: `Componente desconocido "${componentName}" (path "${message.path}").` };
    }
    const dataCheck = dataSchema.safeParse(message.value);
    if (!dataCheck.success) {
      return {
        ok: false,
        reason: `Los datos para "${componentName}" (${message.path}) no cumplen su schema: ${dataCheck.error.message}`,
      };
    }
  }

  return { ok: true, messages };
}
