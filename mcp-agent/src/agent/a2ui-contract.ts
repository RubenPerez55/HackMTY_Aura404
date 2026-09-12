/**
 * Contrato A2UI — decisión del equipo (paso 3, revisado): el JSON de
 * A2UI lo compone el propio LLM, usando los datos que ya obtuvo de las
 * tools MCP normales (`banking.*`, `impact.*`). Los servers MCP se
 * quedan puros: solo dan datos/acciones, nunca arman UI.
 *
 * Este módulo es el "contrato" del que se habló con el equipo: define
 * (a) qué componentes existen y qué datos espera cada uno (debe
 * mantenerse sincronizado con `frontend/src/components/componentRegistry.js`
 * y con `docs/03-arquitectura-tecnica/02-catalogo-componentes.md`), y
 * (b) un validador (`parseA2uiAnswer`) que el backend corre sobre la
 * respuesta final del LLM ANTES de mandarla al frontend — así, si el
 * modelo escribe un JSON mal formado o inventa un componente que no
 * existe, el backend lo detecta (y puede caer a una respuesta de solo
 * texto) en vez de mandarle basura al frontend.
 */
import { z } from "zod";

export const A2UI_CATALOG_ID = "banorte-shockabsorber";

/** Ver docs/03-arquitectura-tecnica/02-catalogo-componentes.md */
export const ComponentDataSchemas = {
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
  confirmation_receipt: z.object({
    folio: z.string(),
    newBalance: z.number().optional(),
    actionDescription: z.string(),
  }),
} as const;

export type ComponentName = keyof typeof ComponentDataSchemas;
export const COMPONENT_NAMES = Object.keys(ComponentDataSchemas) as ComponentName[];

const componentSchema = z.object({
  id: z.string(),
  component: z.enum(COMPONENT_NAMES as [ComponentName, ...ComponentName[]]),
  catalogId: z.string().optional(),
});

/** Los 3 tipos de mensaje A2UI que de verdad usamos (ver paso 2). */
const a2uiMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("createSurface"),
    surfaceId: z.string(),
    root: z.object({ id: z.string(), component: z.enum(COMPONENT_NAMES as [ComponentName, ...ComponentName[]]) }),
  }),
  z.object({
    type: z.literal("updateComponents"),
    surfaceId: z.string(),
    components: z.array(componentSchema),
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
 * UI todavía.
 *
 * Además de validar la forma (JSON + schema), valida que cada
 * `updateDataModel` tenga los campos que su componente espera, cruzando
 * contra `ComponentDataSchemas` -- así detectamos que el modelo "olvidó"
 * un campo antes de que sea el frontend quien se entere a medias.
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

  const componentByRoot = new Map<string, ComponentName>();
  for (const message of parsed.data) {
    if (message.type === "createSurface") componentByRoot.set(message.surfaceId, message.root.component);
    if (message.type === "updateComponents") {
      for (const c of message.components) {
        if (c.id === "root") componentByRoot.set(message.surfaceId, c.component);
      }
    }
  }

  for (const message of parsed.data) {
    if (message.type !== "updateDataModel") continue;
    const component = componentByRoot.get(message.surfaceId);
    if (!component) continue; // no debería pasar si el orden es correcto
    const dataSchema = ComponentDataSchemas[component];
    const dataCheck = dataSchema.safeParse(message.value);
    if (!dataCheck.success) {
      return {
        ok: false,
        reason:
          `Los datos para "${component}" no cumplen su schema: ${dataCheck.error.message}`,
      };
    }
  }

  return { ok: true, messages: parsed.data };
}
