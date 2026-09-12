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
}
