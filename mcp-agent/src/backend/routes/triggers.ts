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

    const { session, queued } = deps.orchestrator.triggerImpact(parsed.data);
    return reply.code(202).send({
      sessionId: session.id,
      queued,
      status: session.status,
      hint: "El agente arranca su conversación por GET /api/sessions/:id/events (SSE).",
    });
  });
}