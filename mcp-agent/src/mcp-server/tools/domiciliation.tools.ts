import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BankDataSource } from "../../data/data-source.js";
import { verifyToken } from "./security.tools.js";

const DEFAULT_ANNUAL_FEE = 1500.0;

interface CandidateService {
  id: string;
  nombre: string;
  categoria: string;
  monto_promedio_mensual: number;
  domiciliado: boolean;
  fecha_proximo_cargo: string;
}

export function registerDomiciliationTools(server: McpServer, data: BankDataSource): void {
  // RF-01.2: Obtener servicios candidatos para domiciliación
  server.registerTool(
    "get_domiciliation_candidates",
    {
      description:
        "Obtiene la comisión de anualidad próxima a vencer y la lista de servicios recurrentes no domiciliados que califican para la exención del 100%.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario bancario"),
      },
    },
    async ({ usuario }) => {
      const user = data.getUser(usuario);
      if (!user) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ error: `Usuario "${usuario}" no encontrado.` }) }],
        };
      }

      const domiciliados = new Set(data.getDomiciliations(usuario));

      // Catálogo de servicios recurrentes comunes detectados en sus movimientos
      const serviciosCandidatos: CandidateService[] = [
        {
          id: "cfe",
          nombre: "CFE Suministro Eléctrico",
          categoria: "Servicios",
          monto_promedio_mensual: 680.0,
          domiciliado: domiciliados.has("CFE Suministro Eléctrico"),
          fecha_proximo_cargo: "2026-09-20",
        },
        {
          id: "telmex",
          nombre: "Telmex Infinitum",
          categoria: "Servicios",
          monto_promedio_mensual: 499.0,
          domiciliado: domiciliados.has("Telmex Infinitum"),
          fecha_proximo_cargo: "2026-09-25",
        },
        {
          id: "naturgy",
          nombre: "Naturgy Gas Natural",
          categoria: "Servicios",
          monto_promedio_mensual: 350.0,
          domiciliado: domiciliados.has("Naturgy Gas Natural"),
          fecha_proximo_cargo: "2026-09-28",
        },
        {
          id: "netflix",
          nombre: "Netflix Estándar",
          categoria: "Entretenimiento",
          monto_promedio_mensual: 219.0,
          domiciliado: domiciliados.has("Netflix Estándar"),
          fecha_proximo_cargo: "2026-10-02",
        },
      ];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              usuario,
              anualidad_tarjeta_mxn: DEFAULT_ANNUAL_FEE,
              dias_restantes_cobro: 4,
              fecha_cobro_prevista: "2026-09-16",
              condicion_exencion: "Domiciliar al menos 1 servicio recurrente antes de la fecha de corte para exentar el 100% de la anualidad.",
              servicios_candidatos: serviciosCandidatos,
            }),
          },
        ],
      };
    },
  );

  // RF-03.2: Simulación de exención en vivo al conmutar interruptores
  server.registerTool(
    "simulate_domiciliation_waiver",
    {
      description:
        "Simula la bonificación inmediata de la anualidad al activar interruptores de domiciliación de servicios.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario"),
        selected_services: z.array(z.string()).describe("Lista de nombres de servicios seleccionados para domiciliar"),
        anualidad_monto: z.number().positive().optional().describe("Monto de la anualidad en MXN (default: $1,500)"),
      },
    },
    async ({ usuario, selected_services, anualidad_monto }) => {
      const fee = anualidad_monto ?? DEFAULT_ANNUAL_FEE;
      const count = selected_services.length;
      const cumpleCondicion = count >= 1;

      const bonificacion = cumpleCondicion ? fee : 0;
      const costoFinal = fee - bonificacion;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              usuario,
              anualidad_original_mxn: fee,
              servicios_activados: selected_services,
              total_servicios_activados: count,
              exencion_aplicada: cumpleCondicion,
              monto_bonificado_mxn: bonificacion,
              costo_final_anualidad_mxn: costoFinal,
              mensaje: cumpleCondicion
                ? `¡Exención del 100% garantizada! Con ${count} servicio(s) domiciliado(s), el costo de tu anualidad pasa de $${fee.toFixed(2)} MXN a $0.00 MXN.`
                : "Selecciona al menos 1 servicio para aplicar la exención del 100%.",
            }),
          },
        ],
      };
    },
  );

  // RF-04.1, RF-04.2: Ejecución de domiciliación y exención de anualidad con SoftToken
  server.registerTool(
    "apply_domiciliation_and_waive_fee",
    {
      description:
        "Formaliza la domiciliación de los servicios seleccionados y cancela el cobro de la anualidad. Requiere autorización SoftToken de 6 dígitos.",
      inputSchema: {
        usuario: z.string().describe("Nombre del usuario"),
        services: z.array(z.string()).min(1).describe("Servicios a domiciliar"),
        token_2fa: z.string().describe("Código SoftToken de 6 dígitos"),
      },
    },
    async ({ usuario, services, token_2fa }) => {
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

      // Registrar domiciliaciones activas
      const activas = data.recordDomiciliations(usuario, services);

      // Registrar folio y comprobante de exención
      const folio = `FOL-DOM-${Math.floor(100000 + Math.random() * 900000)}`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              folio_bancario: folio,
              usuario,
              servicios_domiciliados: services,
              total_domiciliaciones_vigentes: activas,
              anualidad_condonada_mxn: DEFAULT_ANNUAL_FEE,
              cargo_anualidad_final_mxn: 0.0,
              fecha_autorizacion: new Date().toISOString(),
              comprobante: `Domiciliación confirmada y exención de anualidad autorizada con SoftToken. Comisión bonificada: $${DEFAULT_ANNUAL_FEE.toFixed(2)} MXN a $0.00 MXN. Folio: ${folio}.`,
            }),
          },
        ],
      };
    },
  );
}
