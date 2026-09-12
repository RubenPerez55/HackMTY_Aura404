import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BankDataSource } from "../../data/data-source.js";
import { verifyToken } from "./security.tools.js";

const PUNTOS_POR_PESO = 10; // 10 puntos = $1.00 MXN

export function registerPointsTools(server: McpServer, data: BankDataSource): void {
  // RF-03.1, E-01: Simulación de canje de puntos
  server.registerTool(
    "simulate_points_redemption",
    {
      description:
        "Simula la bonificación del sobrecosto de un recibo atípico usando puntos de lealtad Banorte. Si los puntos no cubren el total, calcula la cobertura parcial.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario bancario"),
        charge_amount: z.number().positive().describe("Monto total del cargo actual del servicio en MXN"),
        baseline_amount: z.number().nonnegative().describe("Consumo o promedio histórico habitual del servicio en MXN"),
        points_to_use: z
          .number()
          .nonnegative()
          .optional()
          .describe("Cantidad específica de puntos a canjear. Si se omite, usa el óptimo según el excedente"),
      },
    },
    async ({ usuario, charge_amount, baseline_amount, points_to_use }) => {
      const user = data.getUser(usuario);
      if (!user) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ error: `Usuario "${usuario}" no encontrado.` }) }],
        };
      }

      const excedenteMxn = Math.max(0, Number((charge_amount - baseline_amount).toFixed(2)));
      const puntosDisponibles = user.puntos_fidelidad ?? 0;
      const puntosRequeridosParaExcedente = Math.ceil(excedenteMxn * PUNTOS_POR_PESO);

      let puntosAplicados =
        points_to_use !== undefined
          ? Math.min(points_to_use, puntosDisponibles)
          : Math.min(puntosRequeridosParaExcedente, puntosDisponibles);

      puntosAplicados = Math.max(0, Math.round(puntosAplicados));

      const bonificacionMxn = Number((puntosAplicados / PUNTOS_POR_PESO).toFixed(2));
      const cargoNetoDebito = Number(Math.max(0, charge_amount - bonificacionMxn).toFixed(2));
      const nuevoSaldoPuntos = puntosDisponibles - puntosAplicados;
      const esCoberturaTotal = bonificacionMxn >= excedenteMxn;
      const porcentajeExcedenteCubierto =
        excedenteMxn > 0 ? Math.min(100, Math.round((bonificacionMxn / excedenteMxn) * 100)) : 100;

      let mensaje = "";
      if (puntosDisponibles === 0) {
        mensaje = "El cliente no cuenta con puntos de lealtad disponibles para amortiguar el cargo.";
      } else if (esCoberturaTotal) {
        mensaje = `Impacto neutralizado al 100%: los puntos cubren la totalidad del sobrecosto ($${bonificacionMxn.toFixed(2)} MXN). El usuario solo absorbe su promedio histórico.`;
      } else {
        // Caso límite E-01: Saldo de puntos parcial
        mensaje = `Cobertura parcial (${porcentajeExcedenteCubierto}% del sobrecosto): se aplicaron todos los puntos disponibles (${puntosAplicados} pts = $${bonificacionMxn.toFixed(2)} MXN). Restante a débito: $${cargoNetoDebito.toFixed(2)} MXN.`;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              usuario,
              cargo_total_original: charge_amount,
              promedio_historico: baseline_amount,
              sobrecosto_excedente: excedenteMxn,
              puntos_disponibles: puntosDisponibles,
              puntos_requeridos_total: puntosRequeridosParaExcedente,
              puntos_aplicados: puntosAplicados,
              bonificacion_mxn: bonificacionMxn,
              cargo_neto_debito: cargoNetoDebito,
              nuevo_saldo_puntos: nuevoSaldoPuntos,
              es_cobertura_total: esCoberturaTotal,
              porcentaje_cubierto: porcentajeExcedenteCubierto,
              mensaje,
            }),
          },
        ],
      };
    },
  );

  // RF-04.1, RF-04.2: Ejecución de canje de puntos con SoftToken 2FA
  server.registerTool(
    "apply_points_redemption",
    {
      description:
        "Aplica el canje de puntos de lealtad para amortiguar el cargo del servicio. Requiere SoftToken de 6 dígitos para autorización segura.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario"),
        transaction_id: z.union([z.number(), z.string()]).describe("ID del cargo o transacción del servicio"),
        points_to_redeem: z.number().positive().describe("Puntos autorizados a canjear"),
        token_2fa: z.string().describe("Código SoftToken de 6 dígitos"),
        charge_amount: z
          .number()
          .optional()
          .describe("Monto original del recibo del servicio en MXN (ej. 2450 para CFE)"),
        service_name: z.string().optional().describe("Nombre del servicio a pagar (ej. CFE)"),
      },
    },
    async ({ usuario, transaction_id, points_to_redeem, token_2fa, charge_amount, service_name }) => {
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
          content: [{ type: "text", text: JSON.stringify({ success: false, error: `Usuario "${usuario}" no existe.` }) }],
        };
      }

      const puntosActuales = user.puntos_fidelidad ?? 0;
      const puntosRequeridos = Math.round(points_to_redeem);
      if (puntosRequeridos > puntosActuales) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Saldo insuficiente de puntos. Puntos disponibles: ${puntosActuales}, requeridos: ${puntosRequeridos}.`,
              }),
            },
          ],
        };
      }

      const chargeAmount = charge_amount ?? 2450.0;
      const serviceLabel = service_name || "CFE Suministro Eléctrico";
      const bonificacionMxn = Number((puntosRequeridos / PUNTOS_POR_PESO).toFixed(2));
      const cargoNetoDebito = Number(Math.max(0, chargeAmount - bonificacionMxn).toFixed(2));
      const nuevoSaldoPuntos = puntosActuales - puntosRequeridos;
      const saldoActual = user.saldo_ahorro ?? 0;
      const nuevoSaldoCuenta = Number(Math.max(0, saldoActual - cargoNetoDebito).toFixed(2));

      // 1. Actualizar en base de datos real: saldo de débito y puntos de fidelidad
      data.updateUser(usuario, {
        saldo_ahorro: nuevoSaldoCuenta,
        puntos_fidelidad: nuevoSaldoPuntos,
      });

      // 2. Registrar cobro del servicio con la amortiguación de puntos aplicada
      data.appendTransaction({
        usuario,
        categoria: "Servicios",
        monto: cargoNetoDebito,
        descripcion: `Pago ${serviceLabel} (neto tras amortiguar $${bonificacionMxn.toFixed(2)} MXN con puntos)`,
      });

      // 3. Registrar movimiento de bonificación de lealtad
      data.appendTransaction({
        usuario,
        categoria: "Bonificación Lealtad",
        monto: bonificacionMxn,
        descripcion: `Bonificación Lealtad Banorte (+${puntosRequeridos} pts canjeados)`,
      });

      const folio = `FOL-PTS-${Math.floor(100000 + Math.random() * 900000)}`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              folio_bancario: folio,
              usuario,
              transaccion_asociada: transaction_id,
              puntos_canjeados: puntosRequeridos,
              bonificacion_aplicada_mxn: bonificacionMxn,
              cargo_neto_servicio_mxn: cargoNetoDebito,
              nuevo_saldo_disponible: nuevoSaldoCuenta,
              nuevo_saldo_cuenta: nuevoSaldoCuenta,
              nuevo_saldo_puntos: nuevoSaldoPuntos,
              fecha_autorizacion: new Date().toISOString(),
              comprobante: `Operación autorizada con SoftToken. Se aplicó el pago de ${serviceLabel} por un neto de $${cargoNetoDebito.toLocaleString()} MXN (con bonificación de $${bonificacionMxn.toFixed(2)} MXN por ${puntosRequeridos} puntos). Tu nuevo saldo es $${nuevoSaldoCuenta.toLocaleString()} MXN. Folio: ${folio}.`,
            }),
          },
        ],
      };
    },
  );
}
