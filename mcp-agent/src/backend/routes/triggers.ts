import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { RouteDeps } from "./types.js";

const impactTriggerSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  event: z.unknown().optional(),
});

/**
 * Webhook del motor de detección de impacto: su señal es el detonante
 * que despierta al agente, que después conversa con el usuario usando
 * los tools del server bancario.
 */
export function registerTriggers(app: FastifyInstance, deps: RouteDeps): void {
  app.post("/api/triggers/impact", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = impactTriggerSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Cuerpo inválido", details: parsed.error.flatten() });
    }

    const payload = parsed.data;
    const event = (payload.event as Record<string, unknown>) ?? {};
    const userId = payload.userId;
    if (userId) {
      event.usuario = userId;
    }

    // Si es un choque de liquidez (ej. gasto médico extraordinario), simular el débito real del movimiento
    if (event.tipo === "LIQUIDITY_SHOCK" && userId) {
      const user = deps.data.getUser(userId);
      if (user) {
        const monto = Number(event.monto_compra || 18500);
        const saldoAnterior = user.saldo_ahorro ?? 0;
        const saldoRestante = Math.max(0, Number((saldoAnterior - monto).toFixed(2)));

        // Deducir del saldo disponible
        deps.data.updateUser(userId, {
          saldo_ahorro: saldoRestante,
        });

        // Registrar la transacción de cargo extraordinario
        const tx = deps.data.appendTransaction({
          usuario: userId,
          categoria: (event.categoria as string) || "Salud",
          monto,
          descripcion: `${(event.comercio as string) || "Hospital Ángeles"} - Urgencia médica imprevista`,
        });

        // Inyectar en el evento el transaction_id real y los saldos para el agente
        event.transaction_id = tx.id_transaccion;
        event.saldo_anterior = saldoAnterior;
        event.saldo_restante = saldoRestante;
        event.porcentaje_saldo_consumido = Math.min(100, Math.round((monto / (saldoAnterior || 1)) * 100));
      }
    }

    const { session, queued } = deps.orchestrator.triggerImpact(payload);
    return reply.code(202).send({
      sessionId: session.id,
      queued,
      status: session.status,
      hint: "El agente arranca su conversación por GET /api/sessions/:id/events (SSE).",
    });
  });
}