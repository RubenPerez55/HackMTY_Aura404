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

const chartFormat = z.enum(["number", "currency", "percent"]);
const cartesianFields = {
  title: z.string(),
  subtitle: z.string().optional(),
  currency: z.string().optional(),
  format: chartFormat.optional(),
  labels: z.array(z.string()).max(60),
  series: z.array(
    z.object({
      label: z.string(),
      values: z.array(z.number().finite().nullable()).max(60),
      isProjected: z.boolean().optional(),
    }),
  ).min(1).max(6),
};
const matchingSeries = (value: { labels: string[]; series: { values: (number | null)[] }[] }) =>
  value.series.every((series) => series.values.length === value.labels.length);

/**
 * Componentes "hoja" -- cada uno con su propio `value` validado. Ver
 * docs/03-arquitectura-tecnica/02-catalogo-componentes.md para el
 * detalle visual de cada uno.
 */
export const ComponentDataSchemas = {
  // --- catálogo "compuesto" (piezas reutilizables que el LLM combina) ---
  metric_delta_header: z.object({
    title: z.string(),
    currentValue: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]),
    baselineValue: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]).optional(),
    baselineLabel: z.string().optional(),
    deltaText: z.string().optional(),
    status: z.string().optional().default("warning"),
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
    currency: z.string().optional().default("MXN"),
  }),
  line_graph: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    points: z
      .array(
        z.object({
          label: z.string(),
          value: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]),
          isAnomaly: z.boolean().optional(),
        }),
      )
      .optional(),
    baseline: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]).optional(),
    baselineLabel: z.string().optional(),
    anomalyValue: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]).optional(),
    anomalyLabel: z.string().optional(),
    currency: z.string().optional().default("MXN"),
  }),
  line_chart: z.object(cartesianFields).refine(matchingSeries, {
    message: "Cada serie debe tener un valor por etiqueta; usa null para datos faltantes.",
  }),
  bar_chart: z
    .object({ ...cartesianFields, mode: z.enum(["grouped", "stacked"]).optional() })
    .refine(matchingSeries, { message: "Cada serie debe tener un valor por etiqueta." }),
  donut_chart: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    currency: z.string().optional(),
    format: z.enum(["number", "currency"]).optional(),
    categories: z
      .array(
        z.object({
          label: z.string(),
          amount: z.union([
            z.number().finite().nonnegative(),
            z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, ""))).refine((n) => Number.isFinite(n) && n >= 0),
          ]),
        }),
      )
      .max(6),
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
    selectedId: z.string().optional(),
  }).transform((val) => ({
    ...val,
    selectedId: val.selectedId || val.options[0]?.id || "",
  })),
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
        format: z.string().optional(),
      }),
    ),
    // Si esta pantalla también trae un `solution_matrix_selector` y el
    // slider SOLO tiene sentido para UNA de sus opciones (p. ej. ajustar
    // puntos a canjear no aplica si el usuario elige "diferir a
    // plazos"), pon aquí el `id` de esa opción. El frontend deshabilita
    // el slider (con una nota) cuando el usuario selecciona otra opción,
    // en vez de dejarlo ahí como si siguiera "vivo" sin estarlo.
    appliesToOptionId: z.string().optional(),
  }),
  interactive_toggle_list: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        amount: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]),
        currentPaymentMethod: z.string().optional().default("Manual"),
        currentPaymentPaymentMethod: z.string().optional(),
        isSelected: z.boolean().optional().default(false),
      }).transform((item) => ({
        ...item,
        currentPaymentMethod: item.currentPaymentMethod || item.currentPaymentPaymentMethod || "Manual",
      })),
    ),
  }),
  security_action_gate: z.object({
    actionLabel: z.string(),
    summaryBadge: z.string().optional().default(""),
  }),
  balance_card: z.object({
    title: z.string(),
    availableBalance: z.number(),
    currency: z.string().optional().default("MXN"),
    creditLimit: z.number().optional(),
    currentDebt: z.number().optional(),
  }),
  transaction_list: z.object({
    title: z.string(),
    currency: z.string().optional().default("MXN"),
    transactions: z.array(z.object({
      id: z.string(), description: z.string(), amount: z.number(), date: z.string(),
      category: z.string().optional(),
    })),
  }),
  transaction_detail: z.object({
    merchant: z.string(), amount: z.number(), currency: z.string().optional().default("MXN"),
    date: z.string(), category: z.string().optional(), reference: z.string().optional(),
    paymentMethod: z.string().optional(),
  }),
  spending_chart: z.object({
    title: z.string(), currency: z.string().optional().default("MXN"),
    categories: z.array(z.object({ label: z.string(), amount: z.number().nonnegative() })).min(1),
  }),
  progress_bar: z.object({
    title: z.string(), subtitle: z.string().optional(), current: z.number().optional(),
    target: z.number().positive().optional(), percentage: z.number().min(0).max(100).optional(),
  }).refine((value) => value.percentage != null || (value.current != null && value.target != null), {
    message: "Incluye percentage o el par current/target.",
  }),
  recommendation_card: z.object({
    title: z.string(), description: z.string(), badge: z.string().optional(),
    benefit: z.string().optional(), actionLabel: z.string().optional(),
    actionId: z.string().optional(), actionSummary: z.string().optional(),
  }),
  action_button_group: z.object({
    title: z.string(),
    actions: z.array(z.object({
      id: z.string(), label: z.string(), summary: z.string().optional(),
      iconName: z.string().optional(), variant: z.enum(["primary", "secondary"]).optional(),
    })).min(1),
  }),
  form_field: z.object({
    name: z.string(), label: z.string(),
    type: z.enum(["text", "number", "currency", "email", "tel", "select"]),
    value: z.union([z.string(), z.number()]).optional(), placeholder: z.string().optional(),
    helperText: z.string().optional(), required: z.boolean().optional(),
    min: z.number().optional(), max: z.number().optional(),
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  }),
  date_range_picker: z.object({
    name: z.string().optional(), label: z.string(), startDate: z.string().optional(),
    endDate: z.string().optional(), minDate: z.string().optional(), maxDate: z.string().optional(),
  }),
  data_table: z.object({
    title: z.string(),
    currency: z.string().optional(),
    pageSize: z.number().int().positive().max(50).optional(),
    columns: z.array(z.object({
      key: z.string(),
      label: z.string(),
      sortable: z.boolean().optional(),
      align: z.enum(["left", "right"]).optional(),
      format: z.enum(["text", "number", "currency", "percent", "date"]).optional(),
      currency: z.string().optional(),
      total: z.literal("sum").optional(),
    })).min(1),
    rows: z.array(z.record(z.unknown())),
  }),
  status_badge: z.object({
    label: z.string(), description: z.string().optional(), text: z.string().optional(),
    status: z.enum(["approved", "pending", "rejected", "processing", "neutral"]),
  }),
  timeline: z.object({
    title: z.string(),
    events: z.array(z.object({
      id: z.string(), title: z.string(), description: z.string().optional(), date: z.string().optional(),
      status: z.enum(["complete", "current", "pending", "error"]),
    })).min(1),
  }),
  comparison_card: z.object({
    name: z.string().optional(), title: z.string(), selectedId: z.string().optional(),
    options: z.array(z.object({
      id: z.string(), title: z.string(), subtitle: z.string().optional(), recommended: z.boolean().optional(),
      metrics: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })).min(1),
    })).min(2),
  }),
  document_preview: z.object({
    title: z.string(), documentType: z.string().optional(), date: z.string().optional(),
    size: z.string().optional(), description: z.string().optional(), url: z.string().optional(),
  }),
  empty_state: z.object({
    title: z.string(), description: z.string(), iconName: z.string().optional(),
    actionLabel: z.string().optional(), actionId: z.string().optional(),
  }),
  loading_state: z.object({ title: z.string(), description: z.string().optional() }),
  error_state: z.object({
    title: z.string(), description: z.string(), code: z.string().optional(),
    retryLabel: z.string().optional(), actionId: z.string().optional(),
  }),
  approval_flow: z.object({
    title: z.string(),
    steps: z.array(z.object({
      id: z.string(), label: z.string(), status: z.enum(["complete", "current", "pending"]),
    })).min(1),
    actionLabel: z.string().optional(), actionId: z.string().optional(), actionSummary: z.string().optional(),
  }),
  survey_form: z.object({
    title: z.string(),
    description: z.string().optional(),
    submitLabel: z.string(),
    submitActionId: z.string().optional(),
    submitSummary: z.string().optional(),
    fields: z
      .array(
        z.object({
          name: z.string(),
          label: z.string(),
          type: z.enum(["text", "number", "currency", "email", "tel", "select"]),
          value: z.union([z.string(), z.number()]).optional(),
          placeholder: z.string().optional(),
          required: z.boolean().optional(),
          min: z.number().optional(),
          max: z.number().optional(),
          options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
  data_confidence_badge: z.object({
    status: z.enum(["verified", "estimated", "incomplete"]),
    label: z.string().optional(),
    source: z.string().optional(),
    note: z.string().optional(),
  }),
  insight_card: z.object({
    title: z.string(),
    description: z.string(),
    details: z.array(z.string()).max(8).optional(),
    iconName: z.string().optional(),
    actionLabel: z.string().optional(),
  }),
  financial_progress_visual: z.object({
    title: z.string(),
    current: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]),
    target: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]),
    targetLabel: z.string().optional(),
    currency: z.string().optional(),
    description: z.string().optional(),
  }),
  before_after_visual: z.object({
    title: z.string(),
    before: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]),
    after: z.union([z.number(), z.string().transform((v) => Number(v.replace(/[^0-9.-]/g, "")))]),
    beforeLabel: z.string().optional(),
    afterLabel: z.string().optional(),
    description: z.string().optional(),
    currency: z.string().optional(),
    format: z.enum(["number", "currency", "percent"]).optional(),
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
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim()
    // Algunos modelos escapan `_` como Markdown (`surface\_root`).
    // En JSON ese escape no es válido y además cambia el nombre del nodo;
    // normalizamos únicamente este caso antes de parsear.
    .replace(/\\+_/g, "_");

  let raw: unknown;
  try {
    raw = JSON.parse(unfenced);
  } catch {
    const arrayMatch = unfenced.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try {
        raw = JSON.parse(arrayMatch[0]);
      } catch {
        return { ok: false, reason: "No es JSON válido (probablemente es una respuesta en texto normal)." };
      }
    } else {
      return { ok: false, reason: "No es JSON válido (probablemente es una respuesta en texto normal)." };
    }
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
