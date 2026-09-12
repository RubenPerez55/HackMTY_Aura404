import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Validador de token SoftToken 2FA.
 * Regla de negocio (RF-04.1, E-02): Debe tener exactamente 6 dígitos numéricos.
 */
export function verifyToken(token: string): { valid: boolean; error?: string } {
  if (!token || typeof token !== "string") {
    return {
      valid: false,
      error: "Código SoftToken requerido. Ingresa los 6 dígitos generados en tu app Banorte Móvil.",
    };
  }

  const clean = token.trim();
  if (!/^\d{6}$/.test(clean)) {
    return {
      valid: false,
      error: "Código SoftToken inválido o expirado. Debe contener exactamente 6 dígitos numéricos.",
    };
  }

  return { valid: true };
}

export function registerSecurityTools(server: McpServer): void {
  server.registerTool(
    "validate_soft_token",
    {
      description:
        "Valida el código de autenticación de dos factores (SoftToken) antes de autorizar una operación financiera.",
      inputSchema: {
        token: z.string().describe("Código dinámico de 6 dígitos numéricos"),
      },
    },
    async ({ token }) => {
      const verification = verifyToken(token);
      if (!verification.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                valid: false,
                error: verification.error,
                hint: "Verifica el token en tu aplicación Banorte Móvil e intenta de nuevo sin reiniciar tu configuración.",
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
              valid: true,
              message: "SoftToken validado correctamente. Listo para autorizar la transacción.",
            }),
          },
        ],
      };
    },
  );
}
