import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { RouteDeps } from "./types.js";

const sendMessageSchema = z.object({
  text: z.string().trim().min(1, "El mensaje no puede estar vacío"),
});

export function registerMessages(app: FastifyInstance, deps: RouteDeps): void {
  app.post("/api/sessions/:id/messages", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const parsed = sendMessageSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Cuerpo inválido", details: parsed.error.flatten() });
    }

    try {
      const result = deps.orchestrator.sendMessage(id, parsed.data.text);
      return reply.code(202).send({
        sessionId: result.sessionId,
        queued: result.queued,
        hint: "Los eventos del turno llegan por GET /api/sessions/:id/events (SSE).",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ error: message });
    }
  });
}