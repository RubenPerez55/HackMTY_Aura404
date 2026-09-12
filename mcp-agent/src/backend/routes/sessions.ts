import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { RouteDeps } from "./types.js";

const createSessionSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
});

interface SessionParams {
  id: string;
}

export function registerSessions(app: FastifyInstance, deps: RouteDeps): void {
  app.post("/api/sessions", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createSessionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Cuerpo inválido", details: parsed.error.flatten() });
    }
    const session = deps.orchestrator.createSession(
      parsed.data.userId ?? "anonymous",
      parsed.data.title,
    );
    return reply.code(201).send(session);
  });

  app.get("/api/sessions", async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.query as { userId?: string }).userId;
    return reply.send(deps.orchestrator.listSessions(userId));
  });

  app.get("/api/sessions/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as SessionParams;
    const session = deps.orchestrator.getSession(id);
    if (!session) return reply.code(404).send({ error: `Sesión "${id}" no existe.` });
    return reply.send(session);
  });

  app.delete("/api/sessions/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as SessionParams;
    const ok = await deps.orchestrator.deleteSession(id);
    if (!ok) return reply.code(404).send({ error: `Sesión "${id}" no existe.` });
    return reply.code(204).send();
  });
}