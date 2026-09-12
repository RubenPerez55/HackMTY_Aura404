/**
 * Server MCP "ui" (a2ui): la ÚNICA pieza del sistema que sabe construir
 * mensajes A2UI (createSurface / updateComponents / updateDataModel).
 *
 * Ver docs/03-arquitectura-tecnica/02-catalogo-componentes.md (el
 * catálogo de componentes) y la aclaración de arquitectura sobre por qué
 * esto vive en un Server y no en el AgentHarness/AgentLoop: el Harness
 * solo recuerda la conversación, el Loop solo orquesta llamadas a tools,
 * y este Server es el único con lógica de negocio de "cómo se ve" cada
 * componente.
 *
 * No toca CSVs ni el banco — es una función pura: recibe
 * `component` + `data` (que el agente ya sacó de otras tools, ej.
 * `banking.get_transactions`) y regresa el JSON de A2UI ya armado.
 *
 * Uso (transporte stdio, igual que examples/echo-server.ts):
 *   MCP_UI_COMMAND="tsx" MCP_UI_ARGS="[\"src/mcp-servers/ui-server.ts\"]" npm run serve
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * Catálogo A2UI propio del proyecto (ver docs/03-arquitectura-tecnica/
 * 02-catalogo-componentes.md). Debe mantenerse sincronizado con
 * `frontend/src/components/componentRegistry.js` — el nombre aquí es
 * el `uiHint`/`component` que el frontend resuelve contra su registry.
 */
export const A2UI_CATALOG_ID = "banorte-shockabsorber";

export const COMPONENT_CATALOG = [
  "service_spike_card",
  "annual_fee_card",
  "liquidity_shock_card",
  "two_factor_modal",
  "confirmation_receipt",
] as const;

export type ComponentName = (typeof COMPONENT_CATALOG)[number];

let surfaceCounter = 0;
function nextSurfaceId(): string {
  surfaceCounter += 1;
  return `srv_${Date.now()}_${surfaceCounter}`;
}

/**
 * Construye el trío de mensajes A2UI para montar un componente con sus
 * datos. Misma forma para cualquier componente del catálogo: el frontend
 * decide cómo pintarlo, este server solo describe QUÉ montar y CON QUÉ
 * datos.
 */
export function buildA2uiMessages(component: ComponentName, data: Record<string, unknown>) {
  const surfaceId = nextSurfaceId();

  return [
    {
      type: "createSurface" as const,
      surfaceId,
      root: { id: "root", component },
    },
    {
      type: "updateComponents" as const,
      surfaceId,
      components: [
        {
          id: "root",
          component,
          catalogId: A2UI_CATALOG_ID,
        },
      ],
    },
    {
      type: "updateDataModel" as const,
      surfaceId,
      path: "/",
      value: data,
    },
  ];
}

const server = new McpServer({ name: "ui-server", version: "0.1.0" });

server.registerTool(
  "render_component",
  {
    description:
      "Muestra al usuario un componente de UI interactivo (Agentic UI / A2UI). " +
      "Úsala cuando ya tengas los datos para presentar una solución concreta " +
      "(pico de servicio, anualidad por vencer, golpe de liquidez, 2FA o " +
      "confirmación) en vez de responder solo en texto.",
    inputSchema: {
      component: z.enum(COMPONENT_CATALOG),
      data: z.record(z.unknown()),
    },
  },
  async ({ component, data }) => {
    const messages = buildA2uiMessages(component as ComponentName, data as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify(messages) }] };
  },
);

await server.connect(new StdioServerTransport());
