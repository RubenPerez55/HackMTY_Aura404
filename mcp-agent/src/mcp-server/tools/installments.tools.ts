import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BankDataSource } from "../../data/data-source.js";
import { verifyToken } from "./security.tools.js";

const MIN_INSTALLMENT_AMOUNT = 500.0;
const VALID_MONTHS = [3, 6, 12] as const;

export function registerInstallmentsTools(server: McpServer, data: BankDataSource): void {
  // RF-03.3, E-03: Simulación interactiva de diferimiento
  server.registerTool(
    "simulate_installments",
    {
      description:
        "Simula el diferimiento de una compra a plazos (3, 6 o 12 meses) para estabilizar la liquidez del usuario, calculando la cuota mensual fija y la liquidez inmediata restaurada.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario bancario"),
        purchase_amount: z.number().positive().describe("Monto original de la compra a diferir en MXN"),
        months: z
          .number()
          .refine((m) => (VALID_MONTHS as readonly number[]).includes(m), {
            message: "Los plazos permitidos son 3, 6 o 12 meses.",
          })
          .describe("Plazo seleccionado en meses (3, 6 o 12)"),
      },
    },
    async ({ usuario, purchase_amount, months }) => {
      // Caso Límite E-03: Validación de monto mínimo ($500 MXN)
      if (purchase_amount < MIN_INSTALLMENT_AMOUNT) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                eligible: false,
                purchase_amount,
                min_amount_required: MIN_INSTALLMENT_AMOUNT,
                error: `La compra de $${purchase_amount.toFixed(2)} MXN no es elegible para plan de pagos fijos. El monto mínimo bancario requerido es de $${MIN_INSTALLMENT_AMOUNT.toFixed(2)} MXN.`,
                alternative: "Te sugerimos un ajuste de presupuesto quincenal para absorber el gasto sin financiamiento.",
              }),
            },
          ],
        };
      }

      const user = data.getUser(usuario);
      const saldoActual = user?.saldo_ahorro ?? 0;

      // Plan preferencial Banorte: 0% Meses Sin Intereses para estabilización de liquidez
      const monthlyPayment = Number((purchase_amount / months).toFixed(2));
      const totalPayable = Number((monthlyPayment * months).toFixed(2));
      const liquidezRestaurada = purchase_amount;
      const saldoProyectado = Number((saldoActual + liquidezRestaurada).toFixed(2));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              eligible: true,
              usuario,
              monto_compra_original: purchase_amount,
              plazo_meses: months,
              cuota_mensual_fija: monthlyPayment,
              total_a_pagar: totalPayable,
              cat_promocional: "0.0% Sin Intereses (Plan Alivio Banorte)",
              tasa_interes_anual: 0.0,
              liquidez_inmediata_restaurada: liquidezRestaurada,
              saldo_cuenta_actual: saldoActual,
              saldo_cuenta_proyectado: saldoProyectado,
              resumen: `Al diferir a ${months} meses, recuperas inmediatamente $${liquidezRestaurada.toFixed(2)} MXN en tu saldo disponible. Tu nueva cuota fija será de solo $${monthlyPayment.toFixed(2)} MXN al mes.`,
            }),
          },
        ],
      };
    },
  );

  // RF-04.1, RF-04.2: Ejecución del diferimiento con SoftToken 2FA
  server.registerTool(
    "apply_installments",
    {
      description:
        "Aplica el diferimiento de la compra, reinyecta la liquidez a la cuenta del usuario y calendariza las cuotas. Requiere SoftToken de 6 dígitos.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario"),
        transaction_id: z.union([z.number(), z.string()]).describe("ID de la transacción extraordinaria"),
        purchase_amount: z.number().positive().describe("Monto a diferir"),
        months: z
          .number()
          .refine((m) => (VALID_MONTHS as readonly number[]).includes(m), {
            message: "Los plazos permitidos son 3, 6 o 12 meses.",
          }),
        token_2fa: z.string().describe("Código SoftToken de 6 dígitos"),
      },
    },
    async ({ usuario, transaction_id, purchase_amount, months, token_2fa }) => {
      const auth = verifyToken(token_2fa);
      if (!auth.valid) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: auth.error }) }],
        };
      }

      if (purchase_amount < MIN_INSTALLMENT_AMOUNT) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Compra no elegible: el monto mínimo es de $${MIN_INSTALLMENT_AMOUNT.toFixed(2)} MXN.`,
              }),
            },
          ],
        };
      }

      const user = data.getUser(usuario);
      if (!user) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: `Usuario "${usuario}" no existe.` }) }],
        };
      }

      const saldoActual = user.saldo_ahorro ?? 0;
      const deudaActual = user.deuda_total ?? 0;
      const nuevoSaldo = Number((saldoActual + purchase_amount).toFixed(2));
      const nuevaDeuda = Number((deudaActual + purchase_amount).toFixed(2));
      const cuotaMensual = Number((purchase_amount / months).toFixed(2));

      // Actualizar en base de datos compartida: reintegro de liquidez en saldo_ahorro y registro en deuda_total
      data.updateUser(usuario, {
        saldo_ahorro: nuevoSaldo,
        deuda_total: nuevaDeuda,
      });

      // Registrar transacción de abono de liquidez
      data.appendTransaction({
        usuario,
        categoria: "Abono Liquidez",
        monto: purchase_amount,
        descripcion: `Reintegro por diferimiento a ${months} MSI (Tx #${transaction_id})`,
      });

      const folio = `FOL-MSI-${Math.floor(100000 + Math.random() * 900000)}`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              folio_bancario: folio,
              usuario,
              transaccion_diferida: transaction_id,
              monto_diferido: purchase_amount,
              plazo_meses: months,
              cuota_mensual: cuotaMensual,
              liquidez_inmediata_reintegrada: purchase_amount,
              nuevo_saldo_disponible: nuevoSaldo,
              fecha_autorizacion: new Date().toISOString(),
              primer_vencimiento_cuota: "2026-10-15",
              comprobante: `Diferimiento autorizado con SoftToken. Se ha reintegrado de inmediato $${purchase_amount.toFixed(2)} MXN a tu cuenta disponible. Próxima mensualidad: $${cuotaMensual.toFixed(2)} MXN. Folio: ${folio}.`,
            }),
          },
        ],
      };
    },
  );
}
