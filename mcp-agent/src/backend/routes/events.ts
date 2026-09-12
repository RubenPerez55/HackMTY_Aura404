import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AgentEvent } from "../events/types.js";
import type { RouteDeps } from "./types.js";

const HEARTBEAT_MS = 15_000;

/**
 * Stream SSE por sesión: el frontend se suscribe una vez y recibe todos
 * los eventos del agente (turn.start, tool.use, tool.result, turn.end...)
 * mientras la sesión esté viva.
 */
export function registerEvents(app: FastifyInstance, deps: RouteDeps): void {
  app.get("/api/sessions/:id/events", (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    if (!deps.manager.get(id)) {
      return reply.code(404).send({ error: `Sesión "${id}" no existe.` });
    }

    reply.hijack();
    const res = reply.raw;

    // `reply.hijack()` saca esta respuesta del ciclo normal de Fastify, así
    // que el hook `onSend` de @fastify/cors (registrado con `origin: true`
    // en server.ts) NUNCA corre aquí -- por eso el navegador bloqueaba el
    // EventSource con "No 'Access-Control-Allow-Origin' header" aunque el
    // resto de los endpoints (que sí pasan por el pipeline normal) no
    // tenían ningún problema. Replicamos el mismo comportamiento a mano:
    // reflejar el Origin de la petición.
    const origin = request.headers.origin;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    });
    res.write("retry: 3000\n\n");

    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
    const unsubscribe = deps.bus.subscribe(id, (event: AgentEvent) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    res.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}