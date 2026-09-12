import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BankDataSource } from "../../data/data-source.js";

export function registerProfileTools(server: McpServer, data: BankDataSource): void {
  server.registerTool(
    "get_user_financial_profile",
    {
      description:
        "Obtiene la posición financiera consolidada del cliente: saldo disponible, ingreso, deuda, puntos de fidelidad y tarjetas activas.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario bancario (ej. 'Ruben Perez', 'Hector Barrera')"),
      },
    },
    async ({ usuario }) => {
      const context = data.getUserContext(usuario);
      if (!context) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Usuario "${usuario}" no encontrado en la base de datos bancaria.`,
                availableUsers: data.listNames(),
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              usuario: context.usuario,
              saldo_disponible_debito: context.saldo_ahorro ?? 0,
              ingreso_mensual: context.ingreso_mensual ?? 0,
              deuda_total: context.deuda_total ?? 0,
              puntos_fidelidad: context.puntos_fidelidad ?? 0,
              nivel_fidelidad: context.nivel_fidelidad ?? "Sin asignar",
              score_crediticio: context.score_crediticio,
              historial_crediticio: context.historial_crediticio,
              tarjetas_activas: context.tarjetas_activas.map((t) => ({
                id_tarjeta: t.id_tarjeta,
                tipo: t.tipo,
                marca: t.marca,
                numero_enmascarado: t.numero_enmascarado,
                limite_credito: t.limite_credito,
                saldo_utilizado: t.saldo_utilizado,
              })),
            }),
          },
        ],
      };
    },
  );
}
