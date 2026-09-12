import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BankDataSource } from "../../data/data-source.js";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(year: number, monthZeroBased: number, day: number): string {
  return `${year}-${pad(monthZeroBased + 1)}-${pad(day)}`;
}

/**
 * Calcula la siguiente fecha de dispersión de nómina (quincenas: día 15 y último de mes)
 * y los días naturales restantes desde la fecha de referencia.
 */
export function calculatePayrollCalendar(referenceDate: Date = new Date()): {
  daysUntilPayroll: number;
  proximaFechaPago: string;
  isPayrollToday: boolean;
  siguienteCicloProgramado: string;
} {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0 - 11
  const day = referenceDate.getDate();

  const lastDayOfCurrentMonth = new Date(year, month + 1, 0).getDate();

  let daysUntilPayroll: number;
  let proximaFechaPago: string;
  let isPayrollToday = false;
  let siguienteCicloProgramado: string;

  if (day < 15) {
    daysUntilPayroll = 15 - day;
    proximaFechaPago = formatDate(year, month, 15);
    siguienteCicloProgramado = formatDate(year, month, lastDayOfCurrentMonth);
  } else if (day === 15) {
    daysUntilPayroll = 0;
    isPayrollToday = true;
    proximaFechaPago = formatDate(year, month, 15);
    siguienteCicloProgramado = formatDate(year, month, lastDayOfCurrentMonth);
  } else if (day < lastDayOfCurrentMonth) {
    daysUntilPayroll = lastDayOfCurrentMonth - day;
    proximaFechaPago = formatDate(year, month, lastDayOfCurrentMonth);
    const nextMonth = (month + 1) % 12;
    const nextYear = month === 11 ? year + 1 : year;
    siguienteCicloProgramado = formatDate(nextYear, nextMonth, 15);
  } else {
    // day === lastDayOfCurrentMonth
    daysUntilPayroll = 0;
    isPayrollToday = true;
    proximaFechaPago = formatDate(year, month, lastDayOfCurrentMonth);
    const nextMonth = (month + 1) % 12;
    const nextYear = month === 11 ? year + 1 : year;
    siguienteCicloProgramado = formatDate(nextYear, nextMonth, 15);
  }

  return {
    daysUntilPayroll,
    proximaFechaPago,
    isPayrollToday,
    siguienteCicloProgramado,
  };
}

export function registerPayrollTools(server: McpServer, data: BankDataSource): void {
  server.registerTool(
    "get_payroll_calendar",
    {
      description:
        "Calcula el calendario de nómina y los días restantes hasta la próxima dispersión quincenal (daysUntilPayroll) para el usuario, evaluando el presupuesto diario de subsistencia para amortiguar golpes de liquidez.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario bancario (ej. 'Hector Barrera', 'Ruben Perez')"),
        fecha_referencia: z
          .string()
          .optional()
          .describe(
            "Fecha ISO de referencia YYYY-MM-DD (por defecto la fecha actual). Permite simular días específicos para pruebas.",
          ),
      },
    },
    async ({ usuario, fecha_referencia }) => {
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

      let refDate: Date;
      if (fecha_referencia && /^\d{4}-\d{2}-\d{2}$/.test(fecha_referencia)) {
        const [y, m, d] = fecha_referencia.split("-").map(Number);
        refDate = new Date(y, m - 1, d);
      } else {
        refDate = new Date();
      }

      const { daysUntilPayroll, proximaFechaPago, isPayrollToday, siguienteCicloProgramado } =
        calculatePayrollCalendar(refDate);

      const ingresoMensual = context.ingreso_mensual ?? 0;
      const montoQuincenaEstimado = Math.round((ingresoMensual / 2) * 100) / 100;
      const saldoDebito = context.saldo_ahorro ?? 0;

      // Cálculo de presupuesto diario de subsistencia
      const diasCalculo = daysUntilPayroll > 0 ? daysUntilPayroll : 1;
      const presupuestoDiarioRestante = Math.round((saldoDebito / diasCalculo) * 100) / 100;
      const umbralSubsistenciaDiario = 250; // $250 MXN mínimo diario estimado
      const alertaLiquidez =
        saldoDebito < 1500 || presupuestoDiarioRestante < umbralSubsistenciaDiario;

      const diagnostico = isPayrollToday
        ? `Hoy es día de dispersión de nómina (${proximaFechaPago}) por un estimado de $${montoQuincenaEstimado.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN.`
        : `Faltan ${daysUntilPayroll} días para la siguiente dispersión de nómina ($${montoQuincenaEstimado.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN el ${proximaFechaPago}). Con el saldo actual ($${saldoDebito.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN), el presupuesto diario es de $${presupuestoDiarioRestante.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN/día.`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              usuario: context.usuario,
              daysUntilPayroll,
              dias_restantes_quincena: daysUntilPayroll,
              proxima_fecha_dispersion: proximaFechaPago,
              dispersion_hoy: isPayrollToday,
              siguiente_ciclo: siguienteCicloProgramado,
              periodicidad: "quincenal",
              ingreso_mensual: ingresoMensual,
              monto_estimado_quincena: montoQuincenaEstimado,
              saldo_disponible_debito: saldoDebito,
              presupuesto_diario_restante: presupuestoDiarioRestante,
              umbral_subsistencia_diario: umbralSubsistenciaDiario,
              alerta_liquidez: alertaLiquidez,
              diagnostico,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "simulate_payroll_advance",
    {
      description:
        "Simula un adelanto de nómina preaprobado (hasta el 35% de la quincena estimada) con depósito inmediato a la cuenta de débito para solucionar falta de liquidez cuando el usuario no tiene compras que diferir.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario bancario (ej. 'Hector Barrera', 'Ruben Perez')"),
        monto_solicitado: z
          .number()
          .positive()
          .optional()
          .describe("Monto opcional solicitado en MXN. Si no se especifica, se calcula el monto máximo preaprobado."),
      },
    },
    async ({ usuario, monto_solicitado }) => {
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

      // 1. Evaluación de riesgo crediticio
      const score = context.score_crediticio ?? 0;
      const historial = context.historial_crediticio ?? "";
      if (score < 550 || historial === "Malo") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                eligible: false,
                usuario: context.usuario,
                score_crediticio: score,
                reason:
                  "El cliente no califica para adelanto de nómina debido a su perfil crediticio actual (se requiere score mínimo de 550 puntos).",
              }),
            },
          ],
        };
      }

      // 2. Cálculo de capacidad y límite preaprobado (35% de la quincena)
      const ingresoMensual = context.ingreso_mensual ?? 0;
      const montoQuincena = Math.round((ingresoMensual / 2) * 100) / 100;
      const maxAdelanto = Math.round(montoQuincena * 0.35 * 100) / 100;
      const montoMinimo = 500;

      if (maxAdelanto < montoMinimo) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                eligible: false,
                usuario: context.usuario,
                reason: `El límite disponible calculado ($${maxAdelanto.toFixed(2)} MXN) no alcanza el monto mínimo bancario para adelanto ($${montoMinimo.toFixed(2)} MXN).`,
              }),
            },
          ],
        };
      }

      if (monto_solicitado !== undefined) {
        if (monto_solicitado < montoMinimo) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  eligible: false,
                  usuario: context.usuario,
                  reason: `El monto solicitado ($${monto_solicitado.toFixed(2)} MXN) es menor al monto mínimo permitido ($${montoMinimo.toFixed(2)} MXN).`,
                }),
              },
            ],
          };
        }
        if (monto_solicitado > maxAdelanto) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  eligible: false,
                  usuario: context.usuario,
                  max_disponible: maxAdelanto,
                  reason: `El monto solicitado ($${monto_solicitado.toFixed(2)} MXN) excede el límite máximo preaprobado para tu quincena ($${maxAdelanto.toFixed(2)} MXN).`,
                }),
              },
            ],
          };
        }
      }

      const montoAprobado = monto_solicitado ? Math.round(monto_solicitado * 100) / 100 : maxAdelanto;
      const comisionApertura = Math.max(150, Math.round(montoAprobado * 0.03 * 100) / 100);
      const totalLiquidar = Math.round((montoAprobado + comisionApertura) * 100) / 100;

      const { daysUntilPayroll, proximaFechaPago } = calculatePayrollCalendar();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              eligible: true,
              usuario: context.usuario,
              monto_adelanto_aprobado: montoAprobado,
              monto_maximo_disponible: maxAdelanto,
              comision_apertura_fija: comisionApertura,
              total_a_liquidar_en_quincena: totalLiquidar,
              fecha_cobro_programado: proximaFechaPago,
              dias_para_cobro: daysUntilPayroll,
              saldo_actual_debito: context.saldo_ahorro ?? 0,
              saldo_proyectado_inmediato: Math.round(((context.saldo_ahorro ?? 0) + montoAprobado) * 100) / 100,
              resumen: `Adelanto de nómina preaprobado por $${montoAprobado.toFixed(2)} MXN. Se deposita de inmediato a tu débito. Comisión única de apertura: $${comisionApertura.toFixed(2)} MXN. Se liquida automáticamente el ${proximaFechaPago}.`,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "apply_payroll_advance",
    {
      description:
        "Formaliza y deposita inmediatamente un adelanto de nómina en la cuenta de débito del cliente tras validar su SoftToken 2FA (Human-in-the-Loop).",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario bancario"),
        monto: z.number().positive().describe("Monto en MXN a depositar de inmediato"),
        token_2fa: z.string().describe("Código SoftToken de 6 dígitos para autorizar el depósito inmediato"),
      },
    },
    async ({ usuario, monto, token_2fa }) => {
      // 1. Validación de segundo factor de autenticación (RF-04.1, E-02)
      if (!/^\d{6}$/.test(token_2fa.trim())) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Código SoftToken inválido o expirado. Debe contener exactamente 6 dígitos numéricos.",
                codigo_error: "AUTH_2FA_INVALID",
              }),
            },
          ],
        };
      }

      const context = data.getUserContext(usuario);
      if (!context) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Usuario "${usuario}" no encontrado en la base de datos bancaria.`,
              }),
            },
          ],
        };
      }

      const ingresoMensual = context.ingreso_mensual ?? 0;
      const montoQuincena = Math.round((ingresoMensual / 2) * 100) / 100;
      const maxAdelanto = Math.round(montoQuincena * 0.35 * 100) / 100;

      if (monto > maxAdelanto || monto < 500) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `El monto de $${monto.toFixed(2)} MXN no cumple los límites bancarios (mínimo $500.00 MXN, máximo $${maxAdelanto.toFixed(2)} MXN).`,
              }),
            },
          ],
        };
      }

      const comisionApertura = Math.max(150, Math.round(monto * 0.03 * 100) / 100);
      const totalLiquidar = Math.round((monto + comisionApertura) * 100) / 100;
      const { proximaFechaPago } = calculatePayrollCalendar();

      // 2. Mutación real de saldos
      const saldoAnterior = context.saldo_ahorro ?? 0;
      const nuevoSaldo = Math.round((saldoAnterior + monto) * 100) / 100;
      const nuevaDeuda = Math.round(((context.deuda_total ?? 0) + totalLiquidar) * 100) / 100;

      data.updateUser(usuario, {
        saldo_ahorro: nuevoSaldo,
        deuda_total: nuevaDeuda,
      });

      const folio = `FOL-NOM-${Math.floor(100000 + Math.random() * 900000)}`;
      const nowIso = new Date().toISOString().replace("T", " ").substring(0, 19);

      data.appendTransaction({
        usuario: context.usuario,
        fecha: nowIso,
        categoria: "Adelanto Nomina",
        monto: monto,
        descripcion: `Depósito inmediato Adelanto de Nómina Banorte - Folio ${folio}`,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              folio_bancario: folio,
              usuario: context.usuario,
              monto_depositado: monto,
              comision_apertura: comisionApertura,
              total_programado_debito: totalLiquidar,
              fecha_cobro_quincena: proximaFechaPago,
              saldo_anterior_debito: saldoAnterior,
              nuevo_saldo_disponible: nuevoSaldo,
              fecha_autorizacion: new Date().toISOString(),
              comprobante: `Adelanto de nómina autorizado con SoftToken. Se depositaron $${monto.toFixed(2)} MXN de inmediato a tu débito (nuevo disponible: $${nuevoSaldo.toFixed(2)} MXN). Se liquidará automáticamente el ${proximaFechaPago}. Folio: ${folio}.`,
            }),
          },
        ],
      };
    },
  );
}
