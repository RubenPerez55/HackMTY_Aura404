import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BankDataSource } from "../../data/data-source.js";
import { verifyToken } from "./security.tools.js";

/**
 * Herramientas MCP para ejecución de pagos ordinarios con tarjeta de débito / cuenta de ahorros.
 */
export function registerPaymentTools(server: McpServer, data: BankDataSource): void {
  server.registerTool(
    "process_ordinary_payment",
    {
      description:
        "Procesa o confirma formalmente el pago ordinario de un servicio, factura o comisión bancaria con cargo a la cuenta de débito/ahorro del cliente mediante autorización SoftToken de 6 dígitos. Si el cargo ya fue deducido previamente al detonarse la alerta (como en CFE), valida el segundo factor, confirma la liquidación y emite el folio bancario y comprobante oficial. Si no fue debitado previamente, realiza el débito del saldo y genera el movimiento bancario correspondiente.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario bancario (ej. Ruben Perez)"),
        monto: z.number().positive().optional().describe("Monto total del pago en MXN"),
        amount: z.number().positive().optional().describe("Alias en inglés para monto en MXN"),
        concepto: z
          .string()
          .optional()
          .describe("Concepto o servicio liquidado (ej. CFE Suministro Eléctrico o Anualidad Visa Platinum)"),
        service_name: z.string().optional().describe("Alias para concepto o nombre del servicio"),
        token_2fa: z.string().describe("Código SoftToken de 6 dígitos para autorización segura"),
      },
    },
    async ({ usuario, monto, amount, concepto, service_name, token_2fa }) => {
      const auth = verifyToken(token_2fa);
      if (!auth.valid) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: auth.error }) }],
        };
      }

      const user = data.getUser(usuario);
      if (!user) {
        return {
          isError: true,
          content: [
            { type: "text", text: JSON.stringify({ success: false, error: `Usuario "${usuario}" no encontrado.` }) },
          ],
        };
      }

      const paymentAmount = Number(monto ?? amount ?? 2450.0);
      const paymentConcept = concepto ?? service_name ?? "Pago ordinario con Tarjeta de Débito";

      const txs = data.listTransactions({ usuario });
      const isAlreadyDebited = txs.some(
        (t) =>
          (t.descripcion || "").toLowerCase().includes(paymentConcept.toLowerCase().slice(0, 4)) &&
          Math.abs((t.monto ?? 0) - paymentAmount) < 1,
      );

      let nuevoSaldo = user.saldo_ahorro ?? 0;
      if (!isAlreadyDebited) {
        nuevoSaldo = Math.max(0, Number((nuevoSaldo - paymentAmount).toFixed(2)));
        data.updateUser(usuario, {
          saldo_ahorro: nuevoSaldo,
        });
        data.appendTransaction({
          usuario,
          categoria: "Servicios",
          monto: paymentAmount,
          descripcion: paymentConcept,
        });
      }

      const folio = `FOL-DEB-${Math.floor(100000 + Math.random() * 900000)}`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              folio_bancario: folio,
              usuario,
              monto_pagado: paymentAmount,
              concepto: paymentConcept,
              nuevo_saldo_disponible: nuevoSaldo,
              fecha_operacion: new Date().toISOString(),
              metodo_pago: "Tarjeta de Débito Banorte",
              comprobante: `Pago ordinario de $${paymentAmount.toFixed(2)} MXN (${paymentConcept}) confirmado exitosamente con SoftToken. Folio: ${folio}. Saldo disponible: $${nuevoSaldo.toFixed(2)} MXN.`,
            }),
          },
        ],
      };
    },
  );
}
